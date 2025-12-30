uniform sampler2D uDemTexture;
uniform float uHeightScaleMin;
uniform float uHeightScaleMax;
varying vec2 vUv;

void main() {
    float height = texture2D(uDemTexture, uv).r;
    float normalizedHeight = mix(uHeightScaleMin, uHeightScaleMax, height);
    vec3 displacedPosition = position + vec3(0.0, normalizedHeight, 0.0);
    // gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
    csm_Position = displacedPosition;
    vUv = uv;
}
