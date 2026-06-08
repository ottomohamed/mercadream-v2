self.onmessage = async (e) => {
    const { imageData, pattern } = e.data;
    const data = imageData.data;
    for (let i = 0; i < pattern.length; i++) {
        const { x, y } = pattern[i];
        const idx = (y * imageData.width + x) * 4;
        data[idx + 2] = (data[idx + 2] % 2 === 0) ? data[idx + 2] + 1 : data[idx + 2] - 1;
    }
    self.postMessage({ imageData }, [imageData.data.buffer]);
};
