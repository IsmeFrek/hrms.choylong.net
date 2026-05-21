import multer from 'multer';

// Use memory storage — files are streamed directly to Cloudflare R2
// instead of being written to local disk.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (req, file, cb) => {
    const ext = (require('path').extname(file.originalname) || '').toLowerCase();
    const isImage = (file.mimetype || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.originalname);
    const isPdf   = (file.mimetype || '').toLowerCase() === 'application/pdf' || ext === '.pdf';
    const isDoc   = /\.(docx?|xlsx?|pptx?|txt|csv)$/i.test(file.originalname);
    if (isImage || isPdf || isDoc) return cb(null, true);
    return cb(new Error('Only images, PDFs, or office document files are allowed!'));
  }
});

export default upload;
