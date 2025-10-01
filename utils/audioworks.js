const audioWorks = () => {
  const bufferToInt16Array = (buffer) => {
    if (buffer instanceof Int16Array) return buffer;
    if (buffer instanceof ArrayBuffer) return new Int16Array(buffer);
    if (Buffer.isBuffer(buffer)) {
      // bikin ArrayBuffer baru & copy data
      const copy = new Int16Array(buffer.length / 2);
      for (let i = 0; i < copy.length; i++) {
        copy[i] = buffer.readInt16LE(i * 2);
      }
      return copy;
    }
    throw new Error("Unsupported audio buffer format");
  };
  return {
    bufferToInt16Array,
  };
};

const audiowork = audioWorks();
export default audiowork;
