import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Template } from "../types";
import { Upload, Download, RefreshCw, ZoomIn, ZoomOut, ArrowLeft } from "lucide-react";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1); // 1 means 'cover' scale
  const [position, setPosition] = useState({ x: 0, y: 0 }); // Offset from center
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1); // The scale needed to 'cover' the canvas

  // Fetch template
  useEffect(() => {
    fetch(`/api/templates`)
      .then((res) => res.json())
      .then((data) => {
        const t = data.find((item: Template) => item.id === Number(id));
        if (t) {
          setTemplate(t);
        } else {
          alert("模版不存在");
          navigate("/");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id, navigate]);

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        resetEditor(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Reset editor state
  const resetEditor = useCallback(
    (img: HTMLImageElement | null = image) => {
      if (!img || !template) return;

      // Calculate base scale for 'object-fit: cover'
      const scaleX = template.width / img.width;
      const scaleY = template.height / img.height;
      const newBaseScale = Math.max(scaleX, scaleY);

      setBaseScale(newBaseScale);
      setScale(1); // Reset user scale multiplier to 1
      setPosition({ x: 0, y: 0 }); // Center
    },
    [image, template]
  );

  // Draw on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !template) return;

    // Clear canvas
    ctx.fillStyle = "#f4f4f5"; // zinc-100
    ctx.fillRect(0, 0, template.width, template.height);

    if (!image) {
      // Draw placeholder text
      ctx.fillStyle = "#a1a1aa"; // zinc-400
      ctx.font = "24px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("请上传图片", template.width / 2, template.height / 2);
      return;
    }

    const currentScale = baseScale * scale;
    const scaledWidth = image.width * currentScale;
    const scaledHeight = image.height * currentScale;

    // Calculate drawing coordinates (centered + offset)
    const dx = (template.width - scaledWidth) / 2 + position.x;
    const dy = (template.height - scaledHeight) / 2 + position.y;

    // Apply image opacity
    ctx.globalAlpha = template.image_opacity ?? 1.0;

    // Draw image
    ctx.drawImage(image, dx, dy, scaledWidth, scaledHeight);

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Apply overlay if opacity > 0
    const overlayOpacity = template.overlay_opacity ?? 1;
    if (overlayOpacity > 0 && (template.overlay_gradient || template.overlay_color)) {
      ctx.globalAlpha = overlayOpacity;

      // Gradient takes precedence if both are provided
      if (template.overlay_gradient) {
        try {
          const gradStr = template.overlay_gradient;
          const match = gradStr.match(/linear-gradient\((.*)\)/i);
          
          if (match) {
            // Split by comma, but respect commas inside rgba()
            const parts = match[1].split(/,(?![^(]*\))/).map(s => s.trim());
            
            let direction = parts[0];
            let colors = parts.slice(1);
            
            if (!direction.startsWith('to ') && !direction.endsWith('deg')) {
              colors = parts;
              direction = 'to bottom';
            }

            let x0 = 0, y0 = 0, x1 = 0, y1 = 0;
            const dirLower = direction.toLowerCase();
            
            if (dirLower.endsWith('deg')) {
              const angle = parseFloat(dirLower);
              const angleRad = (angle % 360) * Math.PI / 180;
              x0 = template.width / 2 - Math.sin(angleRad) * template.width / 2;
              y0 = template.height / 2 + Math.cos(angleRad) * template.height / 2;
              x1 = template.width / 2 + Math.sin(angleRad) * template.width / 2;
              y1 = template.height / 2 - Math.cos(angleRad) * template.height / 2;
            } else if (dirLower.includes('to bottom')) {
              y1 = template.height;
            } else if (dirLower.includes('to right')) {
              x1 = template.width;
            } else if (dirLower.includes('to top')) {
              y0 = template.height;
            } else if (dirLower.includes('to left')) {
              x0 = template.width;
            } else {
              y1 = template.height; // Default
            }

            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            
            if (colors.length >= 2) {
              // Add color stops evenly
              colors.forEach((colorStr, index) => {
                const colorMatch = colorStr.match(/(.*?)\s+(\d+(?:\.\d+)?)%$/);
                if (colorMatch) {
                  gradient.addColorStop(parseFloat(colorMatch[2]) / 100, colorMatch[1]);
                } else {
                  gradient.addColorStop(index / (Math.max(1, colors.length - 1)), colorStr);
                }
              });
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, template.width, template.height);
            }
          }
        } catch (e) {
          console.error("Failed to parse gradient", e);
        }
      } else if (template.overlay_color) {
        ctx.fillStyle = template.overlay_color;
        ctx.fillRect(0, 0, template.width, template.height);
      }

      ctx.globalAlpha = 1.0;
    }
  }, [image, template, baseScale, scale, position]);

  // Redraw when state changes
  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !image || !template) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Adjust dx/dy based on canvas display size vs actual size
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const displayScaleX = template.width / rect.width;
    const displayScaleY = template.height / rect.height;

    setPosition((prev) => ({
      x: prev.x + dx * displayScaleX,
      y: prev.y + dy * displayScaleY,
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Download image
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !template || !image) return;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const link = document.createElement("a");
    const timestamp = new Date().getTime();
    link.download = `${template.key}_${template.width}x${template.height}_${timestamp}.jpg`;
    link.href = dataUrl;
    link.click();
  };

  if (loading || !template) {
    return <div className="flex justify-center py-12">加载中...</div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/")}
            className="mr-4 p-2 rounded-full hover:bg-zinc-200 text-zinc-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              {template.name}
            </h1>
            <p className="text-sm text-zinc-500 font-mono mt-1">
              目标尺寸: {template.width} x {template.height} px
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
        {/* Left: Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 bg-zinc-200 rounded-3xl border border-zinc-300 overflow-hidden flex items-center justify-center relative shadow-inner"
        >
          {/* We use a wrapper to maintain aspect ratio and fit within container */}
          <div
            className="relative shadow-lg"
            style={{
              aspectRatio: `${template.width} / ${template.height}`,
              width: "100%",
              maxWidth: "calc(100% - 4rem)",
              maxHeight: "calc(100% - 4rem)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <canvas
              ref={canvasRef}
              width={template.width}
              height={template.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`w-full h-full object-contain bg-white ${
                isDragging ? "cursor-grabbing" : image ? "cursor-grab" : ""
              }`}
              style={{
                touchAction: "none", // Prevent scrolling on touch devices while dragging
              }}
            />
          </div>
        </div>

        {/* Right: Operation Panel */}
        <div className="w-full lg:w-80 flex flex-col gap-6 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">操作面板</h3>
            
            {/* Upload Button */}
            <div className="mb-6">
              <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-primary-300 rounded-2xl cursor-pointer hover:bg-primary-50 hover:border-primary-400 transition-colors group">
                <Upload className="w-5 h-5 text-primary-500 mr-2 group-hover:text-primary-600" />
                <span className="text-sm font-medium text-primary-600 group-hover:text-primary-700">
                  {image ? "重新上传图片" : "上传图片"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Controls (only show if image is uploaded) */}
            <div className={`space-y-6 transition-opacity duration-300 ${image ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
              {/* Zoom Slider */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-zinc-700">缩放比例</label>
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
                    {Math.round(scale * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setScale((s) => Math.max(0.1, s - 0.1))}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.01"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <button
                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                    className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => resetEditor()}
                className="w-full flex items-center justify-center px-4 py-2 border border-zinc-300 shadow-sm text-sm font-medium rounded-xl text-zinc-700 bg-white hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重置位置与缩放
              </button>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-zinc-100">
            <button
              onClick={handleDownload}
              disabled={!image}
              className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white transition-all ${
                image
                  ? "bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  : "bg-zinc-300 cursor-not-allowed"
              }`}
            >
              <Download className="w-5 h-5 mr-2" />
              下载裁剪结果
            </button>
            <p className="text-xs text-center text-zinc-500 mt-3">
              输出格式: JPG, 尺寸: {template.width}x{template.height}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
