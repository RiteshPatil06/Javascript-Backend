import { v2 as cloudinary} from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePAth) => {
    try {
        if (!localFilePAth) return null
        //upload the file  on cloudinary
        const response = await cloudinary.uploader.upload
        (localFilePAth, {
            resource_type: "auto"
        })
        //file has been uploaded succesfully
        console.log("file is uploaded on cloudinary",
            response.url);
            return response;
    } catch (error) {
        fs.unlinkSync(localFilePAth) //remove the locally saved temporary files as the upload opration got failed
        return null;
    }
}

export {uploadOnCloudinary}