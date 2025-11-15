varying vec2 vUv;

uniform sampler2D uDopTexture;
uniform vec3 uTintColor;

void main() {
    vec4 baseColor = texture2D(uDopTexture, vUv);
    csm_DiffuseColor = vec4(baseColor.rgb * uTintColor, baseColor.a);
}
