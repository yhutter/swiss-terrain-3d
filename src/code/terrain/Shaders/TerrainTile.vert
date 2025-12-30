uniform sampler2D uDemTexture;
uniform float uHeightScaleMin;
uniform float uHeightScaleMax;
uniform bool uUseDemTexture;
varying vec2 vUv;

void main() {
    if (uUseDemTexture == true) {
        float height = texture2D(uDemTexture, uv).r;
        float normalizedHeight = mix(uHeightScaleMin, uHeightScaleMax, height);
        vec3 displacedPosition = position + vec3(0.0, normalizedHeight, 0.0);
        csm_Position = displacedPosition;
    } else {
        csm_Position = position;
    }
    vUv = uv;
}
