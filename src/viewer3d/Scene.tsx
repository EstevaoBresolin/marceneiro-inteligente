import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Environment, Grid, Html, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { encaixar, moduloDaPeca, type Limites, type Vec3 } from '../domain/composicao';
import type { Chapa, Peca } from '../domain/types';
import { idBase } from '../templates';

export type Vista = 'iso' | 'frente' | 'lado' | 'topo';

export type OpcoesCena = {
  portaAberta: boolean;
  explodida: boolean;
  transparente: boolean;
  cotas: boolean;
};

export type CenaHandle = { capturarPng: () => string | null };

export type ModuloCena = { id: string; nome: string; limitesLocais: Limites; posicao: Vec3 };

type Props = {
  pecas: Peca[];
  chapas: Chapa[];
  limites: Limites | null;
  modulos: ModuloCena[];
  moduloSel: string | null;
  modoMover: boolean;
  onMover: (id: string, pos: Vec3) => void;
  opcoes: OpcoesCena;
  vista: Vista;
  vistaSeq: number;
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
};

const S = 0.001; // mm → m
const LIM_VAZIO: Limites = { min: [-250, 0, 0], max: [250, 500, 300] };

type PecaMeshProps = {
  peca: Peca;
  cor: string;
  opcoes: OpcoesCena;
  centro: THREE.Vector3;
  selecionada: boolean;
  destacarModulo: boolean;
  modoMover: boolean;
  onSelecionar: (id: string) => void;
  onIniciarArraste: (moduloId: string, e: ThreeEvent<PointerEvent>) => void;
};

function PecaMesh({ peca, cor, opcoes, centro, selecionada, destacarModulo, modoMover, onSelecionar, onIniciarArraste }: PecaMeshProps) {
  const grupo = useRef<THREE.Group>(null);
  const box = peca.box3d!;
  const dob = box.dobradica;
  const espelho = peca.papel === 'espelho';

  // posição relativa ao pivô da dobradiça (se houver)
  const pivo = useMemo(() => new THREE.Vector3(dob ? dob.x : 0, 0, dob ? dob.z : 0), [dob?.x, dob?.z]); // eslint-disable-line react-hooks/exhaustive-deps
  const local = useMemo(() => new THREE.Vector3(...box.pos).sub(pivo), [box.pos[0], box.pos[1], box.pos[2], pivo]); // eslint-disable-line react-hooks/exhaustive-deps
  const deslocExplodido = useMemo(() => new THREE.Vector3(...box.pos).sub(centro).multiplyScalar(0.45), [box.pos[0], box.pos[1], box.pos[2], centro]); // eslint-disable-line react-hooks/exhaustive-deps
  const primeiro = useRef(true);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, dt);
    const alvoRot = dob && opcoes.portaAberta ? dob.sinal * THREE.MathUtils.degToRad(105) : 0;
    g.rotation.y += (alvoRot - g.rotation.y) * k;
    const alvo = opcoes.explodida ? deslocExplodido.clone().add(pivo) : pivo.clone();
    // arraste e medidas acompanham na hora; só a explosão é animada
    if (opcoes.explodida && !primeiro.current) g.position.lerp(alvo, k);
    else g.position.copy(alvo);
    primeiro.current = false;
  });

  const transparente = opcoes.transparente && (peca.papel === 'porta' || espelho || peca.papel === 'lateral');
  const corBorda = selecionada ? '#2f5d7c' : destacarModulo ? '#2f5d7c' : espelho ? '#8aa5b3' : '#7e6a55';

  return (
    <group ref={grupo} position={pivo}>
      <mesh
        position={local}
        castShadow
        receiveShadow
        onPointerDown={(e) => {
          const mid = moduloDaPeca(peca.id);
          if (modoMover && mid) onIniciarArraste(mid, e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelecionar(idBase(peca.id));
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = modoMover ? 'grab' : 'pointer';
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <boxGeometry args={box.size} />
        {espelho ? (
          <meshStandardMaterial color="#dbe7ec" metalness={0.65} roughness={0.12} envMapIntensity={1.4} transparent={transparente} opacity={transparente ? 0.25 : 1} />
        ) : (
          <meshStandardMaterial color={selecionada ? '#9cc3dc' : cor} roughness={0.75} transparent={transparente} opacity={transparente ? 0.22 : 1} depthWrite={!transparente} />
        )}
        <Edges threshold={15} color={corBorda} lineWidth={selecionada || destacarModulo ? 2 : 1} />
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

function Conteudo(props: Props & { controles: React.RefObject<OrbitControlsImpl | null> }) {
  const { pecas, chapas, opcoes, modulos, controles } = props;
  const lim = props.limites ?? LIM_VAZIO;
  const { camera, gl, raycaster } = useThree();
  const modulosRef = useRef(modulos);
  modulosRef.current = modulos;
  const onMoverRef = useRef(props.onMover);
  onMoverRef.current = props.onMover;

  const centro = useMemo(
    () => new THREE.Vector3((lim.min[0] + lim.max[0]) / 2, (lim.min[1] + lim.max[1]) / 2, (lim.min[2] + lim.max[2]) / 2),
    // o centro da explosão não precisa seguir cada milímetro do arraste
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.round(lim.min[0] / 50), Math.round(lim.max[0] / 50), Math.round(lim.max[1] / 50)],
  );

  const iniciarArraste = (moduloId: string, e: ThreeEvent<PointerEvent>) => {
    const m = modulosRef.current.find((x) => x.id === moduloId);
    if (!m) return;
    e.stopPropagation();
    if (controles.current) controles.current.enabled = false;

    // arrasta num plano vertical (x, y); vendo de cima, no plano do chão (x, z)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const deCima = Math.abs(dir.y) > 0.8;
    const plano = deCima ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -e.point.y) : new THREE.Plane(new THREE.Vector3(0, 0, 1), -e.point.z);
    const inicio = e.point.clone().divideScalar(S);
    const pos0 = m.posicao;
    const outros = modulosRef.current.filter((x) => x.id !== moduloId).map((x) => somar(x.limitesLocais, x.posicao));
    // tolerância do encaixe: ~28 px na tela, convertidos para mm na distância atual
    const persp = camera as THREE.PerspectiveCamera;
    const dist = camera.position.distanceTo(e.point);
    const mmPorPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2))) / gl.domElement.clientHeight / S;
    const tol = Math.max(15, 28 * mmPorPx);
    document.body.style.cursor = 'grabbing';

    const mover = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plano, hit)) return;
      hit.divideScalar(S);
      const cand: Vec3 = deCima
        ? [pos0[0] + hit.x - inicio.x, pos0[1], Math.round((pos0[2] + hit.z - inicio.z) / 5) * 5]
        : [pos0[0] + hit.x - inicio.x, pos0[1] + hit.y - inicio.y, pos0[2]];
      const enc = encaixar(m.limitesLocais, cand, outros, tol);
      onMoverRef.current(moduloId, deCima ? [enc[0], pos0[1], cand[2]] : enc);
    };
    const soltar = () => {
      window.removeEventListener('pointermove', mover);
      if (controles.current) controles.current.enabled = true;
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar, { once: true });
  };

  const visiveis = pecas.filter((p) => p.box3d);
  const cor = (p: Peca) => chapas.find((c) => c.id === p.chapaId)?.cor ?? '#eeeeee';
  const L = lim.max[0] - lim.min[0];
  const A = lim.max[1] - lim.min[1];
  const P = lim.max[2] - lim.min[2];
  const folga = Math.max(40, Math.max(L, A) * 0.07);
  const variosModulos = modulos.length > 1;

  return (
    <>
      <group scale={S}>
        {visiveis.map((p) => (
          <PecaMesh
            key={p.id}
            peca={p}
            cor={cor(p)}
            opcoes={opcoes}
            centro={centro}
            selecionada={props.selecionada !== null && idBase(p.id) === props.selecionada}
            destacarModulo={props.modoMover && variosModulos && moduloDaPeca(p.id) === props.moduloSel}
            modoMover={props.modoMover}
            onSelecionar={props.onSelecionar}
            onIniciarArraste={iniciarArraste}
          />
        ))}
        {opcoes.cotas && props.limites && !opcoes.explodida && (
          <>
            <Cota de={[lim.min[0], lim.max[1] + folga, lim.max[2]]} ate={[lim.max[0], lim.max[1] + folga, lim.max[2]]} texto={`${Math.round(L)} mm`} />
            <Cota de={[lim.min[0] - folga, lim.min[1], lim.max[2]]} ate={[lim.min[0] - folga, lim.max[1], lim.max[2]]} texto={`${Math.round(A)} mm`} />
            <Cota de={[lim.max[0] + folga, lim.max[1], lim.min[2]]} ate={[lim.max[0] + folga, lim.max[1], lim.max[2]]} texto={`${Math.round(P)} mm`} />
            {variosModulos &&
              modulos.map((m) => {
                const l = somar(m.limitesLocais, m.posicao);
                return (
                  <Cota
                    key={m.id}
                    de={[l.min[0], lim.min[1] - folga, lim.max[2]]}
                    ate={[l.max[0], lim.min[1] - folga, lim.max[2]]}
                    texto={`${m.nome} ${Math.round(l.max[0] - l.min[0])}`}
                    cor="#59646a"
                  />
                );
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

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.01, far: 100 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onCreated={(s) => (gl.current = s.gl)}
      onPointerMissed={() => props.onSelecionar(null)}
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
      <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.12} minDistance={0.1} maxDistance={20} />
    </Canvas>
  );
});
