varying vec2 vUv;

uniform sampler2D uDemTexture;
uniform bool uUseDemTexture;
uniform float uHeightScaleMin;
uniform float uHeightScaleMax;

void main() {
    vec3 finalPosition = position;
    vUv = uv;
    if (uUseDemTexture) {
        float normalizedHeight = texture2D(uDemTexture, uv).r;
        float height = mix(uHeightScaleMin, uHeightScaleMax, normalizedHeight);
        finalPosition = position + vec3(0.0, height, 0.0);
    }
    csm_PositionRaw = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
}
