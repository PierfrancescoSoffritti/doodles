// Shared world-space sampling. Texture texel centres match WeatherModel.gridSample exactly.
export const weatherGlsl = /* glsl */`
	uniform sampler2D uWeatherMap, uWeatherSurface, uWeatherPrevious, uSurfacePrevious;
	uniform vec2 uWeatherOrigin, uWeatherWind, uWeatherOffset;
	uniform float uWeatherSize, uWeatherRes, uWeatherTime, uLightning, uWeatherBlend;
	uniform vec4 uWeatherPrecip;
	vec2 weatherUv(vec2 p) { return clamp((p - uWeatherOrigin) / uWeatherSize, 0.0, 1.0) * (1.0 - 1.0 / uWeatherRes) + 0.5 / uWeatherRes; }
	vec4 weatherAt(vec2 p) { return mix(texture2D(uWeatherPrevious, weatherUv(p)), texture2D(uWeatherMap, weatherUv(p)), uWeatherBlend); }
	vec4 surfaceWeatherAt(vec2 p) { return mix(texture2D(uSurfacePrevious, weatherUv(p)), texture2D(uWeatherSurface, weatherUv(p)), uWeatherBlend); }
	float mountainSnow(float y, float line) { return smoothstep(700.0, 770.0, y) * smoothstep(line - 45.0, line + 65.0, y); }
	float weatherSnow(vec3 p) { return mountainSnow(p.y, 650.0 + surfaceWeatherAt(p.xz).b * 500.0); }
	vec3 weatherPrecipitation(vec3 p) {
		vec4 w = weatherAt(p.xz); float snow = weatherSnow(p);
		vec3 natural = vec3(max(0.0, w.g - w.a) * vec2(1.0 - snow, snow), w.a);
		return mix(natural, uWeatherPrecip.xyz * vec3(1.0 - snow, snow, 1.0), uWeatherPrecip.w);
	}
	float weatherRain(vec3 p) { return weatherPrecipitation(p).x; }
	float settledSnow(vec3 p) { return surfaceWeatherAt(p.xz).g * smoothstep(700.0, 770.0, p.y); }
`;
