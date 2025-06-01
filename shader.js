const canvas = document.getElementById("shader-canvas");
const gl = canvas.getContext("webgl");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); 

let mouse = [0, 0];
let zoom = 3.0;


if (!canvas || !gl) {
  alert("WebGL or canvas not supported.");
}

else{
    console.log("Web gl and canvas is supported");
}


let isDragging = false;
let lastMouse = [0, 0];
let mouseDelta = [0, 0]; // Used in shader

canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) {
    isDragging = true;
    const touch = e.touches[0];
    lastTouch = [touch.clientX, touch.clientY];
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (isDragging && e.touches.length === 1) {
    e.preventDefault(); // prevent scrolling
    const touch = e.touches[0];
    let dx = touch.clientX - lastTouch[0];
    let dy = touch.clientY - lastTouch[1];
    mouse[0] += dx * 0.001;
    mouse[1] += dy * 0.001; // flip y to match GL
    lastTouch = [touch.clientX, touch.clientY];
  }
}, { passive: false });

canvas.addEventListener("touchend", () => {
  isDragging = false;
});


canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastMouse = [e.clientX, e.clientY];
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - lastMouse[0];
  const dy = e.clientY - lastMouse[1];
  lastMouse = [e.clientX, e.clientY];

  // Update yaw (horizontal)
  mouse[0] += dx * 0.005;

  // Update pitch (vertical) with clamp
  mouse[1] += dy * 0.005;
  const pitchLimit = Math.PI / 2 - 0.05; // just below 90 degrees
  mouse[1] = Math.max(-pitchLimit, Math.min(pitchLimit, mouse[1]));
});

//Zoom
canvas.addEventListener("wheel", (e) => {
  e.preventDefault(); // Prevent page scroll

  zoom += e.deltaY * 0.01;
  zoom = Math.max(1.0, Math.min(10.0, zoom)); // Clamp zoom between 1 and 10
});

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const vertexShaderSource = `
  attribute vec4 position;
  void main() {
    gl_Position = position;
  }
`;

const fragmentShaderSource = `
 precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_zoom;


#define MAX_STEPS 100
#define MAX_DIST 100.
#define SURF_DIST .001
#define TAU 6.283185
#define PI 3.141592
#define S smoothstep
#define T iTime

float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 s) {
    p = abs(p)-s;
	return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}


float GetDist(vec3 p) {
    float grid = abs(p.y) - .1;
    float angle = abs(sin(u_time * 0.9)) - 1.0;
    vec3 P = p;
    P.xz = fract(P.xz) - .5;
    
    //float d = sphereSDF(p, vec3(0.0), 0.3);
     float d = sphereSDF(P, vec3(0.0,angle,0.0), 0.3);
    return d;
}

float RayMarch(vec3 ro, vec3 rd) {
	float dO=0.;
    
    for(int i=0; i<MAX_STEPS; i++) {
    	vec3 p = ro + rd*dO;
        float dS = GetDist(p);
        dO += dS;
        if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
    }
    
    return dO;
}

vec3 GetNormal(vec3 p) {
    vec2 e = vec2(.001, 0);
    vec3 n = GetDist(p) - 
        vec3(GetDist(p-e.xyy), GetDist(p-e.yxy),GetDist(p-e.yyx));
    
    return normalize(n);
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3 
        f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u;
    return normalize(i);
}

void main()
{
     vec2 uv = (gl_FragCoord.xy -.5*u_resolution.xy)/u_resolution.y;
	vec2 m = u_mouse.xy/u_resolution.xy;

    vec3 ro = vec3(0.0, 0.0, u_zoom);
     ro.yz *= Rot(-u_mouse.y); // vertical rotation (pitch)
    ro.xz *= Rot(-u_mouse.x); // horizontal rotation (yaw)
    
    vec3 rd = GetRayDir(uv, ro, vec3(.0,0.0,0.0), 1.0);
    vec3 col = vec3(0.0);
   
    float d = RayMarch(ro, rd);

    if(d<MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = GetNormal(p);
        vec3 r = reflect(rd, n);

        float dif = dot(n, normalize(vec3(.1,.2,3.0)))*.5+.5;
        col = vec3(dif, 0.0, 0.0);
    }
    
    col = pow(col, vec3(.4545));	// gamma correction
    
    gl_FragColor = vec4(col,1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeName = type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT";
    console.error(typeName + " SHADER ERROR:\n", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1, 1, -1, -1, 1,
  -1, 1, 1, -1, 1, 1
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const timeLocation = gl.getUniformLocation(program, "u_time");
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const mouseLocation = gl.getUniformLocation(program, "u_mouse");
const zoomLocation = gl.getUniformLocation(program, "u_zoom");

function render(time) {
   time *= 0.001;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 0.0, 0.0, 1.0);  // black
  gl.clear(gl.COLOR_BUFFER_BIT);     // clear the color buffer

  gl.uniform1f(timeLocation, time);
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  gl.uniform2f(mouseLocation, mouse[0], mouse[1]);
  gl.uniform1f(zoomLocation, zoom);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}



render();
