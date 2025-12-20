import { s3 } from "../config/aws";

export const uploadToS3 = async (file: Express.Multer.File) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: `rooms/${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const result = await s3.upload(params).promise();
  return result.Location; // ✅ URL
};

export const deleteFromS3 = async (key: string) => {
  try {
    await s3
      .deleteObject({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
      })
      .promise(); // v2 uses .promise() for async/await

    console.log(`Deleted ${key} from S3`);
  } catch (err) {
    console.error("Error deleting from S3:", err);
    throw err;
  }
};
