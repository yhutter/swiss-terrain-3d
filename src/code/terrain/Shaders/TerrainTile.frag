varying vec2 vUv;
uniform sampler2D uDopTexture;
void main() {
    vec4 baseColor = texture2D(uDopTexture, vUv);
    // gl_FragColor = baseColor;
    csm_DiffuseColor = baseColor;
}
