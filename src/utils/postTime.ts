const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function formatPostTime(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";

  const elapsedMs = Math.max(0, now.getTime() - created.getTime());
  const calendarDays = Math.max(0, Math.round((startOfDay(now) - startOfDay(created)) / DAY_MS));
  let label: string;

  if (calendarDays === 0) {
    const minutes = Math.floor(elapsedMs / 60000);
    label = minutes < 1 ? "Vừa xong" : minutes < 60 ? `${minutes} phút trước` : `${Math.min(23, Math.floor(minutes / 60))} giờ trước`;
  } else if (calendarDays <= 7) {
    label = `${calendarDays} ngày trước`;
  } else if (calendarDays < 30) {
    label = `${Math.floor(calendarDays / 7)} tuần trước`;
  } else {
    label = `${Math.floor(calendarDays / 30)} tháng trước`;
  }

  if (calendarDays >= 7) {
    label += ` (${created.toLocaleDateString("vi-VN")})`;
  }
  return label;
}
