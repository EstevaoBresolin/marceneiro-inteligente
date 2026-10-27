import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Environment, Grid, Html, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { encaixar, moduloDaPeca, type Limites, type Vec3 } from '../domain/composicao';
import type { Chapa, Peca } from '../domain/types';

export type Vista = 'iso' | 'frente' | 'lado' | 'topo';
export type Ferramenta = 'cursor' | 'mao';

export type OpcoesCena = {
  portaAberta: boolean;
  explodida: boolean;
  transparente: boolean;
  cotas: boolean;
};

/** seleção estilo Figma: um módulo inteiro, ou uma peça dentro dele */
export type Selecao = { modulo: string | null; peca: string | null };

export type CenaHandle = { capturarPng: () => string | null };

export type ModuloCena = { id: string; nome: string; limitesLocais: Limites; posicao: Vec3 };

type Props = {
  pecas: Peca[];
  chapas: Chapa[];
  limites: Limites | null;
  modulos: ModuloCena[];
  ferramenta: Ferramenta;
  sel: Selecao;
  onSelecionar: (s: Selecao) => void;
  onMoverModulo: (id: string, pos: Vec3) => void;
  onMoverPeca: (id: string, centro: Vec3) => void;
  opcoes: OpcoesCena;
  vista: Vista;
  vistaSeq: number;
};

const S = 0.001; // mm → m
const LIM_VAZIO: Limites = { min: [-250, 0, 0], max: [250, 500, 300] };
const AZUL = '#2f5d7c';
const AZUL_HOVER = '#6f9cbc';

type Destaque = 'nenhum' | 'hover' | 'modulo' | 'peca';

type PecaMeshProps = {
  peca: Peca;
  cor: string;
  opcoes: OpcoesCena;
  centro: THREE.Vector3;
  destaque: Destaque;
  onPointerDown: (p: Peca, e: ThreeEvent<PointerEvent>) => void;
  onDoubleClick: (p: Peca, e: ThreeEvent<MouseEvent>) => void;
  onHover: (id: string | null) => void;
};

function PecaMesh({ peca, cor, opcoes, centro, destaque, onPointerDown, onDoubleClick, onHover }: PecaMeshProps) {
  const grupo = useRef<THREE.Group>(null);
  const box = peca.box3d!;
  const dob = box.dobradica;
  const espelho = peca.papel === 'espelho';

  // posição relativa ao pivô da dobradiça (se houver)
  const pivo = useMemo(() => new THREE.Vector3(dob ? dob.x : 0, 0, dob ? dob.z : 0), [dob?.x, dob?.z]); // eslint-disable-line react-hooks/exhaustive-deps
  const local = useMemo(() => new THREE.Vector3(...box.pos).sub(pivo), [box.pos[0], box.pos[1], box.pos[2], pivo]); // eslint-disable-line react-hooks/exhaustive-deps
  const deslocExplodido = useMemo(() => new THREE.Vector3(...box.pos).sub(centro).multiplyScalar(0.45), [box.pos[0], box.pos[1], box.pos[2], centro]); // eslint-disable-line react-hooks/exhaustive-deps
  const primeiro = useRef(true);
  const gaveta = useRef(0);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, dt);
    const alvoRot = dob && opcoes.portaAberta ? dob.sinal * THREE.MathUtils.degToRad(105) : 0;
    g.rotation.y += (alvoRot - g.rotation.y) * k;
    gaveta.current += ((box.gaveta && opcoes.portaAberta ? box.gaveta : 0) - gaveta.current) * k;
    const alvo = (opcoes.explodida ? deslocExplodido.clone().add(pivo) : pivo.clone()).add(new THREE.Vector3(0, 0, gaveta.current));
    // arraste e medidas acompanham na hora; só a explosão é animada
    if (opcoes.explodida && !primeiro.current) g.position.lerp(alvo, k);
    else g.position.copy(alvo);
    primeiro.current = false;
  });

  const transparente = opcoes.transparente && (peca.papel === 'porta' || espelho || peca.papel === 'lateral');
  const corBorda = destaque === 'peca' || destaque === 'modulo' ? AZUL : destaque === 'hover' ? AZUL_HOVER : espelho ? '#8aa5b3' : '#7e6a55';

  return (
    <group ref={grupo} position={pivo}>
      <mesh
        position={local}
        castShadow
        receiveShadow
        onPointerDown={(e) => onPointerDown(peca, e)}
        onDoubleClick={(e) => onDoubleClick(peca, e)}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(peca.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <boxGeometry args={box.size} />
        {espelho ? (
          <meshStandardMaterial color={destaque === 'peca' ? '#b9d4e6' : '#dbe7ec'} metalness={0.65} roughness={0.12} envMapIntensity={1.4} transparent={transparente} opacity={transparente ? 0.25 : 1} />
        ) : (
          <meshStandardMaterial color={destaque === 'peca' ? '#9cc3dc' : cor} roughness={0.75} transparent={transparente} opacity={transparente ? 0.22 : 1} depthWrite={!transparente} />
        )}
        <Edges threshold={15} color={corBorda} lineWidth={destaque === 'nenhum' ? 1 : 2} />
      </mesh>
    </group>
  );
}

function Cota({ de, ate, texto, cor = '#b5895a' }: { de: Vec3; ate: Vec3; texto: string; cor?: string }) {
  const meio: Vec3 = [(de[0] + ate[0]) / 2, (de[1] + ate[1]) / 2, (de[2] + ate[2]) / 2];
  return (
    <group>
      <Line points={[de, ate]} color={cor} lineWidth={1.5} />
      <Html position={meio} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none select-none whitespace-nowrap rounded px-1.5 py-0.5 font-cond text-[12px] font-semibold text-white num" style={{ background: cor }}>
          {texto}
        </span>
      </Html>
    </group>
  );
}

function Camera({ vista, seq, lim, controles }: { vista: Vista; seq: number; lim: Limites; controles: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    const tam = [0, 1, 2].map((i) => (lim.max[i] - lim.min[i]) * S);
    const maior = Math.max(...tam, 0.3);
    const d = maior * 2.6;
    const alvo = new THREE.Vector3(((lim.min[0] + lim.max[0]) / 2) * S, ((lim.min[1] + lim.max[1]) / 2) * S, ((lim.min[2] + lim.max[2]) / 2) * S);
    const off: Record<Vista, THREE.Vector3> = {
      iso: new THREE.Vector3(d * 0.75, d * 0.45, d * 0.95),
      frente: new THREE.Vector3(0, 0, d * 1.1),
      lado: new THREE.Vector3(d * 1.1, 0, 0),
      topo: new THREE.Vector3(0, d * 1.2, 0.0001),
    };
    camera.position.copy(alvo.clone().add(off[vista]));
    controles.current?.target.copy(alvo);
    controles.current?.update();
    // reposiciona só quando o usuário pede uma vista (ou um módulo novo entra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, seq]);
  return null;
}

const somar = (l: Limites, d: Vec3): Limites => ({
  min: [l.min[0] + d[0], l.min[1] + d[1], l.min[2] + d[2]],
  max: [l.max[0] + d[0], l.max[1] + d[1], l.max[2] + d[2]],
});

const limitesDaPeca = (p: Peca): Limites => {
  const b = p.box3d!;
  return { min: [b.pos[0] - b.size[0] / 2, b.pos[1] - b.size[1] / 2, b.pos[2] - b.size[2] / 2], max: [b.pos[0] + b.size[0] / 2, b.pos[1] + b.size[1] / 2, b.pos[2] + b.size[2] / 2] };
};

function Conteudo(props: Props & { controles: React.RefObject<OrbitControlsImpl | null> }) {
  const { pecas, chapas, opcoes, modulos, controles, sel, ferramenta } = props;
  const lim = props.limites ?? LIM_VAZIO;
  const { camera, gl, raycaster } = useThree();
  const [hover, setHover] = useState<string | null>(null);
  const arrastando = useRef(false);

  // refs para os handlers de janela sempre verem o estado atual
  const r = useRef(props);
  r.current = props;

  const centro = useMemo(
    () => new THREE.Vector3((lim.min[0] + lim.max[0]) / 2, (lim.min[1] + lim.max[1]) / 2, (lim.min[2] + lim.max[2]) / 2),
    // o centro da explosão não precisa seguir cada milímetro do arraste
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.round(lim.min[0] / 50), Math.round(lim.max[0] / 50), Math.round(lim.max[1] / 50)],
  );

  useEffect(() => {
    if (!arrastando.current) document.body.style.cursor = hover ? (ferramenta === 'cursor' ? 'default' : 'pointer') : '';
  }, [hover, ferramenta]);

  /**
   * Arraste genérico no plano de frente para a câmera (frente → x/y, cima → x/z, lado → z/y).
   * `aplicar` recebe a nova posição já encaixada.
   */
  const arrastar = (e: ThreeEvent<PointerEvent>, inicial: Vec3, local: Limites, outros: Limites[], grade: number, aplicar: (v: Vec3) => void, aoSoltarSemMover: () => void) => {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ax = [Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z)];
    const normal = ax.indexOf(Math.max(...ax));
    const eixos: [number, number] = normal === 2 ? [0, 1] : normal === 1 ? [0, 2] : [2, 1];
    const n = new THREE.Vector3(normal === 0 ? 1 : 0, normal === 1 ? 1 : 0, normal === 2 ? 1 : 0);
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(n, e.point);
    const inicio = e.point.clone().divideScalar(S);
    const persp = camera as THREE.PerspectiveCamera;
    const mmPorPx = (2 * camera.position.distanceTo(e.point) * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))) / gl.domElement.clientHeight / S;
    const tol = Math.max(8, 22 * mmPorPx);
    const x0 = e.nativeEvent.clientX;
    const y0 = e.nativeEvent.clientY;
    let moveu = false;

    if (controles.current) controles.current.enabled = false;

    const mover = (ev: PointerEvent) => {
      if (!moveu && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      if (!moveu) {
        moveu = true;
        arrastando.current = true;
        document.body.style.cursor = 'grabbing';
      }
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plano, hit)) return;
      hit.divideScalar(S);
      const cand: Vec3 = [...inicial];
      for (const i of eixos) cand[i] = inicial[i] + hit.getComponent(i) - inicio.getComponent(i);
      aplicar(encaixar(local, cand, outros, ev.altKey ? 0 : tol, eixos, ev.altKey ? 1 : grade));
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      if (controles.current) controles.current.enabled = true;
      arrastando.current = false;
      document.body.style.cursor = '';
      if (!moveu) aoSoltarSemMover();
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar, { once: true });
  };

  const onPointerDown = (peca: Peca, e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return;
    e.stopPropagation();
    const mid = moduloDaPeca(peca.id);
    if (!mid) return;
    const { sel: s, ferramenta: f } = r.current;
    const dentro = s.modulo === mid && s.peca !== null; // já está "dentro" do módulo
    const moduloJaSelecionado = s.modulo === mid && s.peca === null;

    if (f === 'mao') {
      // na mão, só seleciona ao soltar sem arrastar (quem arrasta é a câmera)
      const x0 = e.nativeEvent.clientX;
      const y0 = e.nativeEvent.clientY;
      window.addEventListener(
        'pointerup',
        (ev) => {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) r.current.onSelecionar(dentro || moduloJaSelecionado ? { modulo: mid, peca: peca.id } : { modulo: mid, peca: null });
        },
        { once: true },
      );
      return;
    }

    if (dentro) {
      // arrasta a peça
      r.current.onSelecionar({ modulo: mid, peca: peca.id });
      const outros = r.current.pecas.filter((q) => q.box3d && q.id !== peca.id && q.dependeDe !== peca.id).map(limitesDaPeca);
      const b = peca.box3d!;
      const local: Limites = { min: [-b.size[0] / 2, -b.size[1] / 2, -b.size[2] / 2], max: [b.size[0] / 2, b.size[1] / 2, b.size[2] / 2] };
      arrastar(e, b.pos, local, outros, 1, (c) => r.current.onMoverPeca(peca.id, c), () => {});
      return;
    }

    // arrasta o módulo inteiro; clicar de novo num módulo já selecionado entra na peça
    r.current.onSelecionar({ modulo: mid, peca: null });
    const m = r.current.modulos.find((x) => x.id === mid);
    if (!m) return;
    const outros = r.current.modulos.filter((x) => x.id !== mid).map((x) => somar(x.limitesLocais, x.posicao));
    arrastar(e, m.posicao, m.limitesLocais, outros, 5, (pos) => r.current.onMoverModulo(mid, pos), () => {
      if (moduloJaSelecionado) r.current.onSelecionar({ modulo: mid, peca: peca.id });
    });
  };

  const onDoubleClick = (peca: Peca, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const mid = moduloDaPeca(peca.id);
    if (mid) r.current.onSelecionar({ modulo: mid, peca: peca.id });
  };

  const visiveis = pecas.filter((p) => p.box3d);
  const cor = (p: Peca) => chapas.find((c) => c.id === p.chapaId)?.cor ?? '#eeeeee';
  const L = lim.max[0] - lim.min[0];
  const A = lim.max[1] - lim.min[1];
  const P = lim.max[2] - lim.min[2];
  const folga = Math.max(40, Math.max(L, A) * 0.07);
  const variosModulos = modulos.length > 1;
  const hoverMod = hover ? moduloDaPeca(hover) : null;

  const destaqueDe = (p: Peca): Destaque => {
    const mid = moduloDaPeca(p.id);
    if (sel.peca && (p.id === sel.peca || p.dependeDe === sel.peca)) return 'peca';
    const dentroDoHover = hoverMod !== null && sel.modulo === hoverMod;
    if (hover && !arrastando.current && dentroDoHover && p.id === hover) return 'hover';
    if (!sel.peca && sel.modulo && mid === sel.modulo) return 'modulo';
    if (hover && !arrastando.current && !dentroDoHover && mid === hoverMod) return 'hover';
    return 'nenhum';
  };

  return (
    <>
      <group scale={S}>
        {visiveis.map((p) => (
          <PecaMesh key={p.id} peca={p} cor={cor(p)} opcoes={opcoes} centro={centro} destaque={destaqueDe(p)} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} onHover={setHover} />
        ))}
        {opcoes.cotas && props.limites && !opcoes.explodida && (
          <>
            <Cota de={[lim.min[0], lim.max[1] + folga, lim.max[2]]} ate={[lim.max[0], lim.max[1] + folga, lim.max[2]]} texto={`${Math.round(L)} mm`} />
            <Cota de={[lim.min[0] - folga, lim.min[1], lim.max[2]]} ate={[lim.min[0] - folga, lim.max[1], lim.max[2]]} texto={`${Math.round(A)} mm`} />
            <Cota de={[lim.max[0] + folga, lim.max[1], lim.min[2]]} ate={[lim.max[0] + folga, lim.max[1], lim.max[2]]} texto={`${Math.round(P)} mm`} />
            {variosModulos &&
              modulos.map((m) => {
                const l = somar(m.limitesLocais, m.posicao);
                return <Cota key={m.id} de={[l.min[0], lim.min[1] - folga, lim.max[2]]} ate={[l.max[0], lim.min[1] - folga, lim.max[2]]} texto={`${m.nome} ${Math.round(l.max[0] - l.min[0])}`} cor="#59646a" />;
              })}
          </>
        )}
      </group>

      <Grid
        position={[0, lim.min[1] * S - 0.0005, 0]}
        args={[10, 10]}
        cellSize={0.05}
        cellThickness={0.6}
        cellColor="#c9cfcc"
        sectionSize={0.25}
        sectionThickness={1}
        sectionColor="#b0b8b4"
        fadeDistance={6}
        infiniteGrid
      />
      <Camera vista={props.vista} seq={props.vistaSeq} lim={lim} controles={controles} />
    </>
  );
}

export const Cena = forwardRef<CenaHandle, Props>(function Cena(props, ref) {
  const gl = useRef<THREE.WebGLRenderer | null>(null);
  const controles = useRef<OrbitControlsImpl | null>(null);

  useImperativeHandle(ref, () => ({
    capturarPng: () => gl.current?.domElement.toDataURL('image/png') ?? null,
  }));

  // cursor: botão esquerdo é da edição; girar com o direito, mover a vista com shift + direito
  // mão: esquerdo gira, direito move a vista
  const botoes =
    props.ferramenta === 'cursor'
      ? { LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.01, far: 100 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={(s) => (gl.current = s.gl)}
      onPointerMissed={(e) => {
        if ((e as MouseEvent).button === 0) props.onSelecionar({ modulo: null, peca: null });
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <color attach="background" args={['#e9ecea']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[-3, 2, -1]} intensity={0.4} />
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 3, 3]} scale={[6, 2, 1]} />
        <Lightformer intensity={1} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 4, 1]} />
        <Lightformer intensity={0.6} color="#d8c3a5" position={[4, 0, 0]} rotation-y={-Math.PI / 2} scale={[4, 4, 1]} />
      </Environment>
      <Conteudo {...props} controles={controles} />
      <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.12} minDistance={0.1} maxDistance={20} mouseButtons={botoes} />
    </Canvas>
  );
});
