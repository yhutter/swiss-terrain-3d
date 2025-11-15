varying vec2 vUv;

uniform sampler2D uDemTexture;

void main() {
    vUv = uv;

    float height = texture2D(uDemTexture, uv).r;
    
    // Displace position along Y axis
    // vec3 displacedPosition = position + vec3(0.0, height, 0.0);
    // Disable height displacement for testing
    vec3 displacedPosition = position;
    
    csm_PositionRaw = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
