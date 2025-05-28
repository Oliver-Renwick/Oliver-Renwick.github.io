const canvas = document.getElementById("shader-canvas");
const gl = canvas.getContext("webgl");

if (!canvas || !gl) {
  alert("WebGL or canvas not supported.");
}

else{
    console.log("Web gl and canvas is supported");
}

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

// Signed distance function for a sphere
float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

float MandelbulbSDF(vec3 p) {
    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    const int ITERATIONS = 8;
    const float POWER = 8.0;

    for (int i = 0; i < ITERATIONS; i++) {
        r = length(z);
        if (r > 2.0) break;

        // convert to polar coordinates
        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);
        dr =  pow(r, POWER - 1.0) * POWER * dr + 1.0;

        // scale and rotate the point
        float zr = pow(r, POWER);
        theta = theta * POWER;
        phi = phi * POWER;

        // convert back to cartesian coordinates
        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(phi) * sin(theta),
            cos(theta)
        );
        z += p;
    }
    return 0.5 * log(r) * r / dr;
}

mat3 rotationY(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0, c
    );
}

// Scene SDF that includes animated sphere
float sceneSDF(vec3 p) {
    float angle = u_time * 0.5;
    p = rotationY(angle) * p;

    return MandelbulbSDF(p);
}

// Estimate normal at point
vec3 getNormal(vec3 p) {
    float d = 0.001;
    vec2 e = vec2(1.0, -1.0) * d;
    return normalize(vec3(
        sceneSDF(p + vec3(e.x, e.y, e.y)) - sceneSDF(p - vec3(e.x, e.y, e.y)),
        sceneSDF(p + vec3(e.y, e.x, e.y)) - sceneSDF(p - vec3(e.y, e.x, e.y)),
        sceneSDF(p + vec3(e.y, e.y, e.x)) - sceneSDF(p - vec3(e.y, e.y, e.x))
    ));
}

// Simple directional lighting
float getLight(vec3 p) {
    vec3 lightDir = normalize(vec3(0.0, .0, -1.0));
    vec3 n = getNormal(p);
    return clamp(dot(n, lightDir), 0.0, 1.0);
}



void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
    vec3 ro = vec3(0.0, 0.0, -4.5); // camera origin
    vec3 rd = normalize(vec3(uv, 1.5)); // ray direction

    float t = 0.0;
    float dist;
    bool hit = false;
    vec3 p;

    for (int i = 0; i < 64; i++) {
        p = ro + t * rd;
        dist = sceneSDF(p);
        if (dist < 0.001) {
            hit = true;
            break;
        }
        t += dist;
        if (t > 20.0) break;
    }

    vec3 color = vec3(0.0);
    if (hit) {
        float light = getLight(p);
        color = vec3(1.0, 0.1, 0.1) * light; // red tint
    }

    gl_FragColor = vec4(color, 1.0);
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

function render(time) {
   time *= 0.001;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 0.0, 0.0, 1.0);  // black
  gl.clear(gl.COLOR_BUFFER_BIT);     // clear the color buffer

  gl.uniform1f(timeLocation, time);
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}



render();
