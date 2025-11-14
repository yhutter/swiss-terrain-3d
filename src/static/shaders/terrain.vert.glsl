varying vec2 vUv;

uniform sampler2D demTexture;

void main() {
    vUv = uv;

    vec2 texelSize = 1.0 / vec2(500);

    vec2 uvCentered = uv * (1.0 - texelSize) + 0.5 * texelSize;

    float height = texture2D(demTexture, uvCentered).r;
    
    // Sample height from DEM texture
    // float height = texture2D(demTexture, uv).r;
    
    // Displace position along Y axis
    vec3 displacedPosition = position + vec3(0.0, height, 0.0);
    
    csm_PositionRaw = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
