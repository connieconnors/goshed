declare module "heic-convert" {
  type ConvertOptions = {
    buffer: Buffer | Uint8Array | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };
  function convert(options: ConvertOptions): Promise<Buffer | Uint8Array | ArrayBuffer>;
  export default convert;
}
