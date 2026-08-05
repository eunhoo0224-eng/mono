// POST /api/stt — 오디오(멀티파트 file) → 전사 텍스트. 명세 R-A.
import { NextRequest, NextResponse } from 'next/server';
import { transcribe } from '@/lib/providers/stt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'multipart/form-data(file) 요청이 아닙니다.' }, { status: 400 });
  }
  try {
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'file 이 없습니다.' }, { status: 400 });
    }
    const name = (file as File).name || 'turn.webm';
    const text = await transcribe(file, name);
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'STT 실패' }, { status: 500 });
  }
}
