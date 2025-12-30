varying vec2 vUv;
uniform sampler2D uDopTexture;
void main() {
    vec4 baseColor = texture2D(uDopTexture, vUv);
    csm_DiffuseColor = baseColor;
}
