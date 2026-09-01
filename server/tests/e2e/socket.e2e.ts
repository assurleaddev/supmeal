/**
 * Test de bout en bout de la messagerie instantanée (§2.2.8), contre une pile démarrée.
 *
 *   docker compose up -d
 *   npm run test:socket
 *
 * Vérifie l'authentification du socket, le cloisonnement des salons par cookbook, la diffusion
 * temps réel entre deux clients, la persistance, et le refus opposé au rôle READER. Le passage à
 * travers le proxy nginx est également contrôlé : c'est là que la mise à niveau WebSocket peut
 * échouer sans que rien ne le signale côté serveur.
 */
import http from 'node:http';
import assert from 'node:assert/strict';
import { io, Socket } from 'socket.io-client';

const HOST = process.env.E2E_HOST || 'localhost';
const API_PORT = Number(process.env.E2E_PORT || 3000);
const PROXY_PORT = Number(process.env.E2E_PROXY_PORT || 8080);

const API = `http://${HOST}:${API_PORT}`;
const PROXY = `http://${HOST}:${PROXY_PORT}`;

function request(method: string, path: string, options: { body?: unknown; token?: string } = {}) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const payload = options.body ? Buffer.from(JSON.stringify(options.body), 'utf8') : null;
    const req = http.request(
      {
        host: HOST,
        port: API_PORT,
        path,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length }
            : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: { raw } });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let failures = 0;
let checks = 0;

function expect(label: string, condition: boolean, detail = '') {
  checks++;
  console.log(condition ? `  OK   ${label}` : `  FAIL ${label}${detail ? `\n         ${detail}` : ''}`);
  if (!condition) failures++;
}

const section = (title: string) => console.log(`\n── ${title} ──`);

/** Attend un événement, avec délai maximum : un socket muet ne doit pas bloquer le test. */
function waitFor<T>(socket: Socket, event: string, timeoutMs = 6000): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);

    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function connect(url: string, token: string | undefined): Promise<{ socket: Socket; error: string | null }> {
  return new Promise((resolve) => {
    const socket = io(url, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 8000,
    });

    const done = (error: string | null) => resolve({ socket, error });
    socket.once('connect', () => done(null));
    socket.once('connect_error', (err) => done(err.message));
  });
}

const stamp = Date.now();

async function register(prefix: string) {
  const email = `${prefix}${stamp}@socket.local`;
  const reply = await request('POST', '/api/auth/register', {
    body: { email, username: `${prefix}${stamp}`, password: 'password123' },
  });
  assert.equal(reply.status, 201, `inscription ${prefix}: ${JSON.stringify(reply.body)}`);
  return { email, id: reply.body.data.user.id as string, token: reply.body.data.accessToken as string };
}

async function main() {
  assert.equal((await request('GET', '/api/health')).status, 200, `API injoignable sur ${API}`);

  const alice = await register('alice');
  const bob = await register('bob');
  const outsider = await register('outsider');

  const cookbook = await request('POST', '/api/cookbooks', {
    token: alice.token,
    body: { name: `Chat ${stamp}` },
  });
  const cookbookId = cookbook.body.data.id as string;

  const invite = await request('POST', `/api/cookbooks/${cookbookId}/invite`, {
    token: alice.token,
    body: { email: bob.email, role: 'EDITOR' },
  });
  await request('POST', `/api/cookbooks/join/${invite.body.data.token}`, { token: bob.token });

  const sockets: Socket[] = [];

  try {
    // ─────────────────────────────────────
    section('Authentification du socket');

    const anonymous = await connect(API, undefined);
    sockets.push(anonymous.socket);
    expect('connexion sans jeton refusée', anonymous.error !== null, `erreur reçue : ${anonymous.error}`);

    const forged = await connect(API, 'jeton.manifestement.invalide');
    sockets.push(forged.socket);
    expect('jeton invalide refusé', forged.error !== null, `erreur reçue : ${forged.error}`);

    const aliceSocket = await connect(API, alice.token);
    sockets.push(aliceSocket.socket);
    expect('jeton valide accepté', aliceSocket.error === null, aliceSocket.error ?? '');

    const bobSocket = await connect(API, bob.token);
    sockets.push(bobSocket.socket);
    expect('second membre connecté', bobSocket.error === null, bobSocket.error ?? '');

    // ─────────────────────────────────────
    section('Cloisonnement des salons');

    const outsiderSocket = await connect(API, outsider.token);
    sockets.push(outsiderSocket.socket);
    expect('un tiers peut se connecter au socket', outsiderSocket.error === null);

    const rejection = waitFor<string>(outsiderSocket.socket, 'error', 5000);
    outsiderSocket.socket.emit('cookbook:join', cookbookId);
    expect("rejoindre un cookbook dont on n'est pas membre est refusé", (await rejection) !== null);

    // ─────────────────────────────────────
    // ─────────────────────────────────────
    section('Présence');

    // Observée sur une room vierge : Alice arrive la première, sa liste ne doit contenir qu'elle.
    const alicePresence = waitFor<any>(aliceSocket.socket, 'cookbook:presence');
    aliceSocket.socket.emit('cookbook:join', cookbookId);
    const aliceSees = await alicePresence;

    expect('le premier arrivant reçoit la liste de présence', aliceSees !== null);
    expect('la liste porte le cookbook concerné', aliceSees?.cookbookId === cookbookId);
    expect(
      'le premier arrivant ne voit que lui-même',
      aliceSees?.members?.length === 1 && aliceSees.members[0].username === `alice${stamp}`,
      `reçu : ${JSON.stringify(aliceSees?.members)}`,
    );

    // Bob arrive ensuite : il voit Alice et lui-même, et Alice est notifiée.
    const bobPresence = waitFor<any>(bobSocket.socket, 'cookbook:presence');
    const aliceNotified = waitFor<any>(aliceSocket.socket, 'cookbook:joined');
    bobSocket.socket.emit('cookbook:join', cookbookId);

    const bobSees = await bobPresence;
    const arrival = await aliceNotified;

    expect(
      'le second arrivant voit les deux membres',
      bobSees?.members?.length === 2,
      `reçu : ${JSON.stringify(bobSees?.members)}`,
    );
    expect('les membres déjà présents sont notifiés', arrival !== null);
    expect("l'arrivée nomme l'utilisateur", arrival?.username === `bob${stamp}`);
    expect("l'arrivée porte le cookbook", arrival?.cookbookId === cookbookId);
    expect(
      "un arrivant n'est pas notifié de sa propre arrivée",
      (await waitFor<any>(bobSocket.socket, 'cookbook:joined', 1500)) === null,
    );

    // Deux onglets d'un même compte tiennent deux sockets : la liste doit dédupliquer par
    // utilisateur, sinon Bob y figurerait deux fois.
    const bobSecondTab = await connect(API, bob.token);
    const tabPresence = waitFor<any>(bobSecondTab.socket, 'cookbook:presence');
    bobSecondTab.socket.emit('cookbook:join', cookbookId);
    const seenFromTab = await tabPresence;

    expect(
      'un compte ouvert deux fois ne compte qu’une présence',
      seenFromTab?.members?.length === 2,
      `reçu : ${JSON.stringify(seenFromTab?.members)}`,
    );

    // Fermer l'onglet n'émet aucun `cookbook:leave` : c'est la déconnexion qui doit le faire.
    // Sans cela, un utilisateur restait affiché comme présent jusqu'au rechargement des autres.
    const aliceSeesDrop = waitFor<any>(aliceSocket.socket, 'cookbook:left');
    bobSecondTab.socket.disconnect();
    const dropped = await aliceSeesDrop;

    expect('une déconnexion brutale diffuse aussi le départ', dropped !== null);
    expect('elle nomme le bon utilisateur', dropped?.username === `bob${stamp}`);
    expect('elle porte le cookbook', dropped?.cookbookId === cookbookId);

    // Départ explicite, puis retour — la section suivante a besoin de Bob dans la room.
    const aliceSeesLeave = waitFor<any>(aliceSocket.socket, 'cookbook:left');
    bobSocket.socket.emit('cookbook:leave', cookbookId);
    const departure = await aliceSeesLeave;

    expect('un départ explicite est diffusé', departure !== null);
    expect("le départ nomme l'utilisateur", departure?.username === `bob${stamp}`);

    section('Diffusion temps réel');

    aliceSocket.socket.emit('cookbook:join', cookbookId);
    bobSocket.socket.emit('cookbook:join', cookbookId);
    await new Promise((r) => setTimeout(r, 500));

    const bobReceives = waitFor<any>(bobSocket.socket, 'cookbook:message');
    const aliceReceives = waitFor<any>(aliceSocket.socket, 'cookbook:message');

    const sent = 'Le gratin est prêt à 19 h — pensez à la crème fraîche !';
    aliceSocket.socket.emit('cookbook:sendMessage', { cookbookId, content: sent });

    const atBob = await bobReceives;
    const atAlice = await aliceReceives;

    expect('le destinataire reçoit le message', atBob !== null);
    expect('accents et ponctuation préservés', atBob?.content === sent, `reçu : ${atBob?.content}`);
    expect('auteur identifié', atBob?.username === `alice${stamp}`);
    expect("l'expéditeur reçoit aussi le message diffusé", atAlice !== null);
    expect('horodatage fourni', typeof atBob?.createdAt === 'string');

    const outsiderShouldNotReceive = waitFor<any>(outsiderSocket.socket, 'cookbook:message', 2000);
    expect('le tiers ne reçoit rien', (await outsiderShouldNotReceive) === null);

    // ─────────────────────────────────────
    section('Persistance et historique');

    const history = await request('GET', `/api/cookbooks/${cookbookId}/messages`, { token: bob.token });
    expect('historique accessible aux membres', history.status === 200);
    expect('message persisté en base', history.body?.data?.some((m: any) => m.content === sent) === true);
    expect(
      'historique refusé à un tiers',
      (await request('GET', `/api/cookbooks/${cookbookId}/messages`, { token: outsider.token })).status === 403,
    );

    // ─────────────────────────────────────
    section('Rôle READER');

    await request('PATCH', `/api/cookbooks/${cookbookId}/members/${bob.id}`, {
      token: alice.token,
      body: { role: 'READER' },
    });

    const readerSocket = await connect(API, bob.token);
    sockets.push(readerSocket.socket);
    readerSocket.socket.emit('cookbook:join', cookbookId);
    await new Promise((r) => setTimeout(r, 400));

    const refusal = waitFor<string>(readerSocket.socket, 'error', 5000);
    const shouldNotBroadcast = waitFor<any>(aliceSocket.socket, 'cookbook:message', 2500);
    readerSocket.socket.emit('cookbook:sendMessage', { cookbookId, content: 'un lecteur écrit' });

    expect('un READER est refusé à l envoi', (await refusal) !== null);
    expect('aucun message diffusé', (await shouldNotBroadcast) === null);

    const afterRefusal = await request('GET', `/api/cookbooks/${cookbookId}/messages`, { token: alice.token });
    expect(
      'rien de persisté pour le READER',
      afterRefusal.body?.data?.some((m: any) => m.content === 'un lecteur écrit') !== true,
    );

    // ─────────────────────────────────────
    section('Traversée du proxy nginx');

    // La mise à niveau WebSocket doit être relayée par nginx : sans les en-têtes Upgrade, le chat
    // est cassé dans le déploiement Docker alors que le serveur, lui, fonctionne.
    const throughProxy = await connect(PROXY, alice.token);
    sockets.push(throughProxy.socket);
    expect(`connexion via ${PROXY}`, throughProxy.error === null, throughProxy.error ?? '');

    if (throughProxy.error === null) {
      expect(
        'transport WebSocket effectivement négocié',
        throughProxy.socket.io.engine.transport.name === 'websocket',
        `transport utilisé : ${throughProxy.socket.io.engine.transport.name}`,
      );

      throughProxy.socket.emit('cookbook:join', cookbookId);
      await new Promise((r) => setTimeout(r, 400));
      const viaProxy = waitFor<any>(throughProxy.socket, 'cookbook:message');
      throughProxy.socket.emit('cookbook:sendMessage', { cookbookId, content: 'message via le proxy' });
      expect('aller-retour complet à travers le proxy', (await viaProxy)?.content === 'message via le proxy');
    }
  } finally {
    for (const socket of sockets) socket.close();

    // Nettoyage : le cookbook emporte ses messages par cascade.
    await request('DELETE', `/api/cookbooks/${cookbookId}`, { token: alice.token });
  }

  console.log(`\n${checks - failures}/${checks} vérifications passent.`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\nLe test a échoué avant son terme :', err.message);
  console.error(`Vérifiez que la pile tourne : API sur ${API}, client sur ${PROXY}.`);
  process.exit(1);
});
