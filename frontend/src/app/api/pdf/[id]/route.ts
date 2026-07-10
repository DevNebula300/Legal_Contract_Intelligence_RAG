import { NextRequest, NextResponse } from 'next/server';
const BACKEND_URL = 'http://localhost:8000';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/contracts/${id}/file`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength === 0) {
      console.error(`[/api/pdf/${id}] Backend returned empty body`);
      return NextResponse.json({ error: 'File is empty on server' }, { status: 404 });
    }
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (err) {
    console.error(`[/api/pdf/${id}] error:`, err);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}