varying vec2 vUv;

uniform sampler2D uDemTexture;
uniform bool uUseDemTexture;

void main() {
    vUv = uv;
    vec3 finalPosition = position;
    if (uUseDemTexture) {
        float height = texture2D(uDemTexture, uv).r;
        finalPosition = position + vec3(0.0, height, 0.0);
    }
    csm_PositionRaw = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
}
