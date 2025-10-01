import fs from "fs";

const staticPath = "./static";
export const fileUploader = () => {
  const deleteImage = (filePath) => {
    return new Promise((resolve, reject) => {
      fs.unlink(`${staticPath}/${filePath}`, (err) => {
        if (err) {
          return reject(err);
        }
        resolve({ status: 200, message: "Image deleted successfully" });
      });
    });
  };
  const uploadImage = (base64Image) => {
    return new Promise((resolve, reject) => {
      try {
        const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches) {
          return reject(new Error("Invalid base64 string"));
        }

        const type = matches[1];
        const buffer = Buffer.from(matches[2], "base64");

        const fileName = `image_${Date.now()}.${type.split("/")[1]}`;
        const filePath = `${fileName}`;

        fs.writeFile(`${staticPath}/public/${filePath}`, buffer, (err) => {
          if (err) {
            return reject(err);
          }
          resolve(filePath);
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  return {
    uploadImage,
    deleteImage,
  };
};

const fileUploaderInstance = fileUploader();
export default fileUploaderInstance;
