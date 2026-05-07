declare module 'next/server' {
  export interface NextRequest extends Request {
    cookies?: any;
    nextUrl?: any;
    page?: any;
    ua?: any;
  }

  export const NextResponse: any;
}
