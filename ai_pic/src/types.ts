export interface Template {
  id: number;
  name: string;
  key: string;
  width: number;
  height: number;
  description: string;
  status: number;
  sort_order?: number;
  image_opacity?: number;
  overlay_color?: string;
  overlay_gradient?: string;
  overlay_opacity?: number;
}
