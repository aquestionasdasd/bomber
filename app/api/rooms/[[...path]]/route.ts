import { env } from 'cloudflare:workers';
import { handleRooms } from '../../../../server/rooms.js';

export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleRooms(request, env); }
export function POST(request: Request) { return handleRooms(request, env); }
