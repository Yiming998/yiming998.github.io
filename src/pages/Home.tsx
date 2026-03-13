import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Template } from "../types";
import { Image as ImageIcon, ArrowRight } from "lucide-react";

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.filter((t: Template) => t.status === 1));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12">加载中...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900">选择裁剪模版</h1>
        <p className="mt-2 text-zinc-600">请选择适合您业务场景的图片尺寸模版</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col"
          >
            <div className="p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-primary-50 rounded-xl">
                  <ImageIcon className="w-6 h-6 text-primary-600" />
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 font-mono">
                  {template.width} x {template.height}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                {template.name}
              </h3>
              <p className="text-sm text-zinc-500 line-clamp-2">
                {template.description || "暂无描述"}
              </p>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100">
              <Link
                to={`/editor/${template.id}`}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                使用此模版
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500">
            暂无可用模版，请联系管理员配置。
          </div>
        )}
      </div>
    </div>
  );
}
