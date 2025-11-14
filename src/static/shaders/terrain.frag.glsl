varying vec2 vUv;

uniform sampler2D dopTexture;

void main() {
    vec4 baseColor = texture2D(dopTexture, vUv);
    csm_DiffuseColor = baseColor;
}
