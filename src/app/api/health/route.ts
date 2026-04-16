/**
 * GET /api/health — 健康检查端点
 * 无需鉴权，用于监控和负载均衡器探测
 */

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
