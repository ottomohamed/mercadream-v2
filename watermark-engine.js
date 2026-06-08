export const WatermarkEngine = {
    generatePattern(width, height, seed, count = 1000) {
        let pattern = [];
        let s = seed.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
        for (let i = 0; i < count; i++) {
            s = Math.sin(s) * 10000;
            pattern.push({ x: Math.floor((s - Math.floor(s)) * width), y: Math.floor((Math.sin(s + 1) * 10000 - Math.floor(Math.sin(s + 1) * 10000)) * height) });
        }
        return pattern;
    },
    apply(imageData, pattern) {
        const data = imageData.data;
        pattern.forEach(p => {
            const idx = (p.y * imageData.width + p.x) * 4;
            data[idx + 2] = (data[idx + 2] % 2 === 0) ? data[idx + 2] + 1 : data[idx + 2] - 1;
        });
        return imageData;
    }
};
