export function GET(request: Request) {
  return Response.redirect(new URL('/play.html', request.url), 302);
}
