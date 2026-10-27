import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Environment, Grid, Html, Lightformer, Line, OrbitControls } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
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

type Props = {
  pecas: Peca[];
  chapas: Chapa[];
  dimensoes: { largura: number; altura: number; profundidade: number };
  opcoes: OpcoesCena;
  vista: Vista;
  vistaSeq: number;
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
};

const S = 0.001; // mm → m

function PecaMesh({ peca, cor, opcoes, centro, selecionada, onSelecionar }: { peca: Peca; cor: string; opcoes: OpcoesCena; centro: THREE.Vector3; selecionada: boolean; onSelecionar: (id: string) => void }) {
  const grupo = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const box = peca.box3d!;
  const dob = box.dobradica;
  const espelho = peca.papel === 'espelho';

  // posição relativa ao pivô da dobradiça (se houver)
  const pivo = useMemo(() => new THREE.Vector3(dob ? dob.x : 0, 0, dob ? dob.z : 0), [dob]);
  const local = useMemo(() => new THREE.Vector3(...box.pos).sub(pivo), [box.pos, pivo]);
  const deslocExplodido = useMemo(() => {
    const d = new THREE.Vector3(...box.pos).sub(centro);
    return d.multiplyScalar(0.45);
  }, [box.pos, centro]);

  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, dt);
    const alvoRot = dob && opcoes.portaAberta ? dob.sinal * THREE.MathUtils.degToRad(105) : 0;
    g.rotation.y += (alvoRot - g.rotation.y) * k;
    const alvo = opcoes.explodida ? deslocExplodido.clone().add(pivo) : pivo.clone();
    g.position.lerp(alvo, k);
  });

  const transparente = opcoes.transparente && (peca.papel === 'porta' || espelho || peca.papel === 'lateral');

  return (
    <group ref={grupo} position={pivo}>
      <mesh
        ref={mesh}
        position={local}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelecionar(idBase(peca.id));
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <boxGeometry args={box.size} />
        {espelho ? (
          <meshStandardMaterial color="#dbe7ec" metalness={0.65} roughness={0.12} envMapIntensity={1.4} transparent={transparente} opacity={transparente ? 0.25 : 1} />
        ) : (
          <meshStandardMaterial
            color={selecionada ? '#9cc3dc' : cor}
            roughness={0.75}
            transparent={transparente}
            opacity={transparente ? 0.22 : 1}
            depthWrite={!transparente}
          />
        )}
        <Edges threshold={15} color={selecionada ? '#2f5d7c' : espelho ? '#8aa5b3' : '#7e6a55'} lineWidth={selecionada ? 2 : 1} />
      </mesh>
    </group>
  );
}

function Cota({ de, ate, texto, deslocTexto }: { de: [number, number, number]; ate: [number, number, number]; texto: string; deslocTexto?: [number, number, number] }) {
  const meio: [number, number, number] = [(de[0] + ate[0]) / 2 + (deslocTexto?.[0] ?? 0), (de[1] + ate[1]) / 2 + (deslocTexto?.[1] ?? 0), (de[2] + ate[2]) / 2 + (deslocTexto?.[2] ?? 0)];
  return (
    <group>
      <Line points={[de, ate]} color="#b5895a" lineWidth={1.5} />
      <Html position={meio} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none select-none whitespace-nowrap rounded bg-mdf px-1.5 py-0.5 font-cond text-[12px] font-semibold text-white num">{texto}</span>
      </Html>
    </group>
  );
}

function Camera({ vista, seq, dims, controles }: { vista: Vista; seq: number; dims: Props['dimensoes']; controles: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    const maior = Math.max(dims.largura, dims.altura, dims.profundidade, 300) * S;
    const d = maior * 2.6;
    const alvo = new THREE.Vector3(0, (dims.altura * S) / 2, (dims.profundidade * S) / 2);
    const pos: Record<Vista, THREE.Vector3> = {
      iso: new THREE.Vector3(d * 0.75, alvo.y + d * 0.45, d * 0.95),
      frente: new THREE.Vector3(0, alvo.y, d * 1.1),
      lado: new THREE.Vector3(d * 1.1, alvo.y, alvo.z),
      topo: new THREE.Vector3(0, alvo.y + d * 1.2, alvo.z + 0.0001),
    };
    camera.position.copy(pos[vista]);
    controles.current?.target.copy(alvo);
    controles.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, seq, dims.largura, dims.altura, dims.profundidade]);
  return null;
}

export const Cena = forwardRef<CenaHandle, Props>(function Cena(props, ref) {
  const { pecas, chapas, dimensoes: dims, opcoes } = props;
  const gl = useRef<THREE.WebGLRenderer | null>(null);
  const controles = useRef<OrbitControlsImpl | null>(null);

  useImperativeHandle(ref, () => ({
    capturarPng: () => gl.current?.domElement.toDataURL('image/png') ?? null,
  }));

  const visiveis = pecas.filter((p) => p.box3d);
  const centro = useMemo(() => new THREE.Vector3(0, dims.altura / 2, dims.profundidade / 2), [dims.altura, dims.profundidade]);
  const cor = (p: Peca) => chapas.find((c) => c.id === p.chapaId)?.cor ?? '#eeeeee';

  const L = dims.largura;
  const A = dims.altura;
  const P = dims.profundidade;
  const folgaCota = Math.max(40, Math.max(L, A) * 0.08);

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

      <group scale={S}>
        {visiveis.map((p) => (
          <PecaMesh
            key={p.id}
            peca={p}
            cor={cor(p)}
            opcoes={opcoes}
            centro={centro}
            selecionada={props.selecionada !== null && idBase(p.id) === props.selecionada}
            onSelecionar={props.onSelecionar}
          />
        ))}
        {opcoes.cotas && L > 0 && !opcoes.explodida && (
          <>
            <Cota de={[-L / 2, A + folgaCota, P]} ate={[L / 2, A + folgaCota, P]} texto={`${L} mm`} />
            <Cota de={[-L / 2 - folgaCota, 0, P]} ate={[-L / 2 - folgaCota, A, P]} texto={`${A} mm`} />
            <Cota de={[L / 2 + folgaCota, A, 0]} ate={[L / 2 + folgaCota, A, P]} texto={`${P} mm`} />
          </>
        )}
      </group>

      <Grid
        position={[0, -0.0005, 0]}
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
      <OrbitControls ref={controles} makeDefault enableDamping dampingFactor={0.12} minDistance={0.1} maxDistance={20} />
      <Camera vista={props.vista} seq={props.vistaSeq} dims={dims} controles={controles} />
    </Canvas>
  );
});
