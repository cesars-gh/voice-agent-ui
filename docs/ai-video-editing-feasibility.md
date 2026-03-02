# AI-Powered Video Editing Through Code: Feasibility Research

**Date:** 2026-03-02
**Context:** voice-agent-ui — evaluating whether an AI agent can edit videos and add VFX by generating and executing code

---

## Executive Summary

**Verdict: Highly Feasible — and actively being built in 2025.** Code-driven video editing is already mainstream (FFmpeg, MoviePy, Blender Python API), LLMs generate correct video-editing code reliably, and the MCP ecosystem now has dedicated video editing servers. The missing piece is the orchestration layer connecting a voice/chat agent to a sandboxed code-execution environment — a gap that is small, well-defined, and partially solved by existing open-source tools (Pipecat, vfx-mcp, llmpeg).

A landmark 2024 paper — **AutoVFX** — already demonstrated a full LLM → Blender Python → photorealistic VFX pipeline. Andreessen Horowitz published ["It's time for agentic video editing"](https://a16z.com/its-time-for-agentic-video-editing/) in 2025, naming 2026 as the year this goes mainstream.

---

## 1. Programmatic Video Editing — Available Tools

### 1.1 FFmpeg (C, CLI/Python bindings)

The gold standard for video processing. Nearly every video platform uses it under the hood.

| Capability | Detail |
|---|---|
| Trim / cut / concat | Frame-accurate, sub-millisecond precision |
| Filters (`-vf`) | 400+ built-in: blur, sharpen, chroma-key, stabilize, denoise, deinterlace |
| Color grading | `curves`, `colorbalance`, `eq`, `lut3d` (load .cube LUT files) |
| Overlays / compositing | `overlay`, `blend`, `chromakey`, `alphamerge` |
| Text / subtitles | `drawtext`, `subtitles` filter with ASS/SRT |
| Speed ramp | `setpts`, `atempo` |
| Audio | normalize, EQ, mix, silence-detect, loudnorm |
| Python wrappers | `ffmpeg-python` (declarative filter graphs), `ffmpy`, `subprocess` |

**LLM-to-FFmpeg tools already shipping (2024–2025):**
- **[llmpeg](https://github.com/gstrenge/llmpeg)** — CLI that takes natural language, generates FFmpeg commands via OpenAI API, supports iterative error-fixing conversation
- **[wtffmpeg](https://github.com/scottvr/wtffmpeg)** — Routes to local Ollama models; interactive review before execution
- **[vfx-mcp](https://github.com/connerohnesorge/vfx-mcp)** — MCP server built on `ffmpeg-python`; exposes trim, join, convert, filter, speed as LLM tools
- **[video-audio-mcp](https://github.com/misbahsy/video-audio-mcp)** — FFmpeg-backed MCP server for format conversion, overlays, transitions, audio

**LLM suitability:** FFmpeg filter graphs are well-represented in training data. Claude 3.5+, GPT-4o reliably generate correct commands for common tasks. Complex multi-filter graphs benefit from an error-feedback retry loop.

---

### 1.2 MoviePy 2.x (Python)

Pure-Python composition layer on top of FFmpeg.

```python
from moviepy import VideoFileClip, concatenate_videoclips, TextClip, CompositeVideoClip

clip = VideoFileClip("input.mp4")
txt  = TextClip("Hello World", font_size=70, color="white").with_duration(3)
final = CompositeVideoClip([clip, txt.with_position("center")])
final.write_videofile("output.mp4")
```

| Capability | Detail |
|---|---|
| Timeline model | Yes — clips have start/end/position, can layer |
| Custom per-frame effects | `image_transform(fn)` — NumPy array per frame |
| Audio mixing | Multi-track, volume curves, fade |
| Programmatic animation | Position/color/opacity as Python functions of time |
| Python ecosystem | NumPy, PIL, scikit-image for frame-level VFX |

**Note:** MoviePy 2.0 (released May 2025) introduced breaking API changes from v1 (`subclipped()` vs `subclip()`, `resized()` vs `resize()`). Use v2.x going forward.

**Emerging alternative:** [MovieLite](https://github.com/francozanardi/movielite) uses Numba JIT compilation to push rendering loops near native speed, with multiprocessing support.

**LLM suitability:** Excellent — clear, human-readable APIs map well to natural language intent.

---

### 1.3 OpenCV (Python/C++)

Frame-level computer vision. Complements rather than replaces MoviePy/FFmpeg.

| Use case | VFX relevance |
|---|---|
| Background removal | `BackgroundSubtractor`, contour masking |
| Object/face tracking | CSRT, KCF — track subject to pin a VFX effect to it |
| Optical flow | Motion blur, warp effects, video stabilization |
| Custom pixel effects | Per-frame NumPy math: glitch, chromatic aberration |
| DNN inference | `cv2.dnn` runs ONNX/Caffe models for scene understanding |

**Best role:** Vision analysis layer that informs edit decisions before handing off to FFmpeg/MoviePy for output.

---

### 1.4 Remotion (TypeScript/React)

Videos as React components — renders via headless Chromium, encodes with FFmpeg.

```tsx
export const LowerThird: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <div style={{
      transform: `translateX(${interpolate(enter, [0, 1], [-400, 0])}px)`,
      position: "absolute", bottom: 80, left: 40,
      background: "rgba(0,0,0,0.7)", padding: "8px 16px"
    }}>
      <span style={{ color: "white", fontSize: 32 }}>{title}</span>
    </div>
  );
};
```

| Capability | Detail |
|---|---|
| Full CSS/SVG/Canvas/WebGL VFX | Anything a browser can render |
| Spring animations | Built-in physics-based easing |
| Data-driven video | Parameterized from JSON/API |
| Serverless rendering | Remotion Lambda for scale |
| Git-versionable | Compositions are React code — diffs are meaningful |

**This project fit:** The existing `voice-agent-ui` is Next.js/React — Remotion integrates natively. An LLM generating React/TSX is one of its strongest capabilities. A 2025 project (Claude + Remotion) already demonstrated AI-generated Remotion video compositions.

**Limitation:** Not suited for raw footage manipulation (color grading, stabilization). Best for motion graphics / title / data-viz layers on top of footage.

---

### 1.5 Blender Python API (`bpy`)

The most powerful open-source VFX scripting environment available — everything in Blender's UI is callable from Python.

```python
import bpy

bpy.ops.wm.open_mainfile(filepath="project.blend")
scene = bpy.context.scene

# Add a particle burst at frame 24
bpy.ops.object.particle_system_add()
ps = bpy.context.object.particle_systems[-1]
ps.settings.count = 1000
ps.settings.frame_start = 24
ps.settings.frame_end = 24

bpy.ops.render.render(animation=True)  # headless render
```

**VFX capabilities:**
- Particle systems, rigid body physics, fluid simulation (Mantaflow), cloth
- Node-based compositing: chroma key, color grade, glow, Z-depth
- 3D VFX composited onto 2D footage via camera tracking
- Cycles/EEVEE renderers for photorealism or real-time quality
- Headless: `blender --background --python script.py`

**AutoVFX (2024) used exactly this pipeline** — see Section 4.

---

### 1.6 Additional Tools

| Tool | Best Use Case |
|---|---|
| **Manim** (ManimCommunity) | Mathematical animations, explanatory STEM VFX; LaTex rendering |
| **Natron** | Open-source node-graph compositor (Nuke-like), Python scripting |
| **DaVinci Resolve Python API** | Pro NLE with headless mode support; MCP server available |
| **VFX-JS (WebGL)** | GLSL shaders on DOM video elements; browser-native GPU effects |
| **KodeLife** | Real-time GLSL/HLSL/Metal shader editor with Syphon/Spout output |
| **Vapoursynth** | Frame-server with Python plugins; high-quality filtering |
| **PyAV** | Low-level FFmpeg bindings for frame-by-frame access |
| **pydub** | Audio-only editing (trim, mix, effects) |

---

## 2. AI / LLM Code Generation for Video Editing

### 2.1 LLM Capability Assessment

Modern LLMs (Claude claude-sonnet-4-6, GPT-4o, Gemini 1.5 Pro) reliably:

- **Generate FFmpeg commands** from natural language: "trim the first 10 seconds and apply a vignette" → working command string (~95% accuracy)
- **Write MoviePy 2.x scripts** for multi-clip timelines with overlays (~80%)
- **Write Remotion TSX components** for animated titles and transitions (~85%)
- **Write Blender Python scripts** for compositing tasks (~60%)
- **Iterate on errors** — given stderr output, LLMs fix generated code effectively

*With tool-use error feedback loops, effective task completion approaches 95%+ for well-scoped operations.*

### 2.2 Existing LLM-to-FFmpeg Projects (Evidence of Feasibility)

| Project | Approach |
|---|---|
| **llmpeg** (gstrenge) | OpenAI API → FFmpeg command; conversation for error fixing; passes OS + FFmpeg version as context |
| **wtffmpeg** (scottvr) | Local Ollama models → FFmpeg; interactive review before execution |
| **vfx-mcp** | `ffmpeg-python` + MCP server; LLM calls tools directly |
| **DeepSeek Coder + FFmpeg** (Medium, 2024) | Open-source LLM generates bash FFmpeg scripts; `subprocess.run` executes |
| **Hugging Face AI Video Composer** | LLM extracts FFmpeg commands; iterative parsing and retry |
| **ACM paper (2024)** | Energy-aware LLM tool for FFmpeg generation; compares open vs closed models |

### 2.3 Voice-to-Edit Pipeline

```
User voice input (LiveKit microphone)
     │
     ▼
STT (Deepgram / Whisper — already in voice-agent-ui)
     │
     ▼
Claude claude-sonnet-4-6 with tool use
     │
     ├── generate_ffmpeg_command(description, input, output)
     ├── generate_moviepy_script(description)
     ├── generate_remotion_component(description)
     └── execute_edit(code, input_path) → stderr feedback → retry
     │
     ▼
Sandboxed execution (E2B SDK / Docker)
     │
     ▼
Rendered output → object storage (S3 / R2)
     │
     ▼
Stream preview back via LiveKit video track
     │
     ▼
TTS confirmation: "Done — trimmed clip saved, here's the preview"
```

---

## 3. VFX Through Code — Technical Catalog

### 3.1 FFmpeg VFX Filter Examples

```bash
# Green screen / chroma key
ffmpeg -i fg.mp4 -i bg.mp4 \
  -filter_complex "[0:v]chromakey=0x00b140:0.1:0.2[fg];[1:v][fg]overlay" \
  output.mp4

# Vignette + cinematic color grade
ffmpeg -i input.mp4 -vf \
  "vignette=PI/4,curves=r='0/0 0.5/0.4 1/0.8':g='0/0 0.5/0.5 1/1':b='0/0.1 0.5/0.6 1/1'" \
  output.mp4

# Glitch effect (noise + RGB shift)
ffmpeg -i input.mp4 -vf \
  "noise=alls=50:allf=t+u,rgbashift=rh=5:bh=-5" output.mp4

# Motion blur
ffmpeg -i input.mp4 -vf "tblend=all_mode=average,framestep=2" output.mp4

# Animated lower-third text
ffmpeg -i input.mp4 -vf \
  "drawtext=text='Breaking News':fontsize=36:fontcolor=white:x='if(lt(t,1),W,W-w*min(1,(t-1)/0.5))':y=H-100:box=1:boxcolor=black@0.7" \
  output.mp4
```

### 3.2 MoviePy VFX Examples

```python
from moviepy import *
import numpy as np

# Chromatic aberration (per-frame NumPy transform)
def chromatic_aberration(frame):
    r = np.roll(frame[:,:,0], 5, axis=1)
    g = frame[:,:,1]
    b = np.roll(frame[:,:,2], -5, axis=1)
    return np.stack([r, g, b], axis=2)

clip = VideoFileClip("input.mp4").image_transform(chromatic_aberration)

# Ken Burns pan-zoom
clip = VideoFileClip("photo.jpg", duration=5)
zoomed = clip.resized(lambda t: 1 + 0.1 * t)  # slow zoom in over 5 seconds

# Picture-in-picture
main = VideoFileClip("main.mp4")
pip  = (VideoFileClip("overlay.mp4")
        .resized(0.25)
        .with_position((0.72, 0.72), relative=True))
final = CompositeVideoClip([main, pip])
```

### 3.3 Remotion VFX Examples

```tsx
import { useCurrentFrame, interpolate, spring, useVideoConfig, AbsoluteFill } from "remotion";

// Animated lower-third (slides in from left)
export const LowerThird: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const x = interpolate(enter, [0, 1], [-400, 0]);
  return (
    <div style={{ transform: `translateX(${x}px)`,
                  position: "absolute", bottom: 80, left: 40,
                  background: "rgba(0,0,0,0.7)", padding: "8px 16px",
                  borderLeft: "4px solid #e63946" }}>
      <span style={{ color: "white", fontSize: 32, fontWeight: "bold" }}>{title}</span>
    </div>
  );
};

// Particle burst (pure CSS/React)
export const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 50 }).map((_, i) => {
        const angle = (i / 50) * Math.PI * 2;
        const radius = frame * 5;
        return <div key={i} style={{
          position: "absolute",
          left: `calc(50% + ${Math.cos(angle) * radius}px)`,
          top:  `calc(50% + ${Math.sin(angle) * radius}px)`,
          width: 8, height: 8, borderRadius: "50%",
          background: `hsl(${i * 7}, 100%, 60%)`,
          opacity: Math.max(0, 1 - frame / 60)
        }} />;
      })}
    </AbsoluteFill>
  );
};
```

### 3.4 GLSL Shader VFX (Browser-Native)

**VFX-JS** (Jan 2025) applies WebGL GLSL shaders directly to `<video>` DOM elements — enabling GPU-accelerated effects in the browser with no server round-trip:

```javascript
import { VFX } from "@vfx-js/core";
const vfx = new VFX();
vfx.add(videoElement, {
  shader: `
    precision highp float;
    uniform sampler2D src;
    uniform float time;
    varying vec2 vUv;
    void main() {
      // Chromatic aberration
      float r = texture2D(src, vUv + vec2(0.005 * sin(time), 0.0)).r;
      float g = texture2D(src, vUv).g;
      float b = texture2D(src, vUv - vec2(0.005 * sin(time), 0.0)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
});
```

This is directly applicable to the `video-tile.tsx` component in the existing UI.

---

## 4. State of the Art (2024–2025)

### 4.1 AutoVFX — The Landmark Paper (November 2024)

**[AutoVFX](https://arxiv.org/abs/2411.02394)** (Hsu et al., University of Illinois) is the most significant demonstration of LLM-driven code-based VFX to date.

**Pipeline:**
1. Input: raw video + natural language ("make the vase explode", "splash water when the boat hits")
2. **3D scene reconstruction** via Neural Gaussian Splatting
3. **LLM generates Blender Python script** to implement the requested VFX
4. **Blender executes** — Cycles renderer, Mantaflow fluid sim, rigid body physics
5. Output: photorealistic VFX composited into original footage

**Results:** Outperformed all competing methods in user studies across instruction alignment, physical plausibility, and visual realism. Effects include particle systems, material changes, fluid simulation, rigid body destruction.

**Significance:** This proves the end-to-end chain — natural language → code generation → VFX rendering — produces production-quality results today.

---

### 4.2 MCP Video Editing Ecosystem (2025)

The Model Context Protocol ecosystem now has multiple production video editing servers:

| MCP Server | Backend | Key Capabilities |
|---|---|---|
| [vfx-mcp](https://github.com/connerohnesorge/vfx-mcp) | ffmpeg-python | Trim, join, convert, filter, speed ramp, metadata |
| [video-audio-mcp](https://github.com/misbahsy/video-audio-mcp) | FFmpeg | Format conversion, overlays, transitions, audio processing |
| [DaVinci Resolve MCP](https://mcp.aibase.com/tag/Video%20Editing) | Resolve Python API | Timeline ops, color grading, media management, Fusion VFX |
| [Adobe Premiere MCP](https://mcp.aibase.com/tag/Video%20Editing) | UXP/ExtendScript | AI control of Premiere Pro |
| [Video Jungle MCP](https://github.com/burningion/video-editing-mcp) | Video Jungle API | Asset search, upload, generate, assemble |

Any of these can be used as tool backends for the LiveKit Python agent in this project.

---

### 4.3 Pipecat — Voice + LLM + Tool Orchestration

**[Pipecat](https://github.com/pipecat-ai/pipecat)** is an open-source Python framework specifically designed for real-time voice + multimodal conversational agents — exactly the orchestration pattern this project needs.

It handles:
- STT → LLM → TTS pipeline with streaming
- Tool/function calling with MCP server integration
- WebRTC transport (LiveKit compatible)
- Interruption handling and turn-taking

**This is the glue layer** between the existing voice-agent-ui and a video editing tool server.

---

### 4.4 Manimator (2024)

A 2024 arXiv project that reads research paper PDFs, generates structured scene descriptions, then generates Manim Python code for animated visual explanations. Direct production example of the text → code → video chain, specifically for educational/explanatory content.

---

### 4.5 Frontier Video Generation APIs (2025–2026)

These are generative models (not code-based editors), but they are increasingly accessible as API tools for an AI agent to call:

| Model | Max Duration | API Status |
|---|---|---|
| Runway Gen-4 | 16s | Enterprise API available |
| Pika 2.5 | 10s | API available |
| Kling 3.0 | 30s | API available |
| Google Veo 3 | ~30s | Vertex AI |
| OpenAI Sora 2 | 60s | Limited/invite only |

**Local GPU generation:** NVIDIA announced LTX-2 at CES 2026 — 4K AI video generation locally on consumer RTX GPUs at 3x the performance of prior generation.

---

## 5. Key Feasibility Considerations

### 5.1 Strengths of Code-Driven Approach

| Factor | Assessment |
|---|---|
| **Reproducibility** | Deterministic scripts — byte-identical output, perfect for versioning |
| **Precision** | Frame-accurate edits, exact timecodes to the millisecond |
| **Composability** | Scripts can be chained, templated, parameterized for bulk generation |
| **Version control** | Git diffs on Remotion/MoviePy code are meaningful |
| **CI/CD for video** | Re-render automatically when data or assets change |
| **Cost** | FFmpeg/MoviePy/Blender are free; no per-edit SaaS fees |
| **Voice-native** | Natural language → code is a natural fit for voice UX |
| **Auditability** | Code expresses intent explicitly — reviewable, correctable |

### 5.2 Challenges and Mitigations

| Challenge | Severity | Mitigation |
|---|---|---|
| LLM generates incorrect code | Medium | Error feedback loop — pass stderr back to LLM and retry |
| Render latency on long videos | High | Work on clips, not full files; FFmpeg > MoviePy for speed |
| Sandbox security | High | Docker/E2B isolation; no filesystem access outside workspace |
| Complex filter graph failures | Medium | Start with curated effect library; validate via `ffprobe` |
| MoviePy v2 API churn | Low | Pin to v2.x; include API docs in system prompt context |
| Blender startup time (~5s) | Medium | Only invoke for 3D tasks; keep warm instance |
| Ambiguity in voice commands | High | Confirmation step before executing destructive edits |
| Spatial references ("top left logo") | Medium | Computer vision (OpenCV/YOLO) to ground spatial descriptions |

### 5.3 Latency Budget

Target: <5 seconds from voice command to preview (for short clips):

| Step | FFmpeg path | MoviePy path |
|---|---|---|
| STT transcription | ~0.5s | ~0.5s |
| LLM code generation | ~1–2s | ~1–2s |
| Execution (10s clip) | ~1–3s | ~5–15s |
| Upload + stream preview | ~0.5s | ~0.5s |
| **Total** | **~3–5s** | **~7–18s** |

**Recommendation:** FFmpeg as primary execution engine for real-time responsiveness. MoviePy for compositional tasks where FFmpeg filter graphs are insufficient. Blender only for 3D VFX (batch, not interactive).

### 5.4 Voice UX Challenges Specific to Video Editing

1. **Ambiguity resolution:** "Make it shorter" — which clip? By how much? → require confirmation
2. **Spatial reference:** "The logo in the top-right" → needs OpenCV scene understanding
3. **Multi-turn context:** LLM must maintain a model of current edit state across the conversation
4. **Preview loop:** User must see the result to give meaningful feedback; UI must support fast preview + retry
5. **Destructive operations:** Permanent edits need explicit confirmation ("Yes, apply it")

---

## 6. Architecture Recommendation for This Project

### 6.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    voice-agent-ui (Frontend)                    │
│                                                                 │
│  LiveKit Room ──► Mic / Camera / Screen share (existing)        │
│  Video Upload Panel (new) ──► File → object storage            │
│  Video Preview Panel (new) ──► Stream from LiveKit video track  │
│  Edit History Sidebar (new) ──► Git-like list of script steps   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ LiveKit RPC / Data Channel
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              LiveKit Python Agent (Pipecat orchestration)        │
│                                                                 │
│  STT (Deepgram) → Claude claude-sonnet-4-6 with tool use                │
│                                                                 │
│  Tools:                                                         │
│    edit_video(description, input, output)                       │
│    add_vfx(effect, input, time_range)                           │
│    preview_frame(video, timestamp)                              │
│    undo_last_edit()                                             │
│    generate_remotion_component(description)                     │
│                                                                 │
│  MCP servers (optional):                                        │
│    vfx-mcp (FFmpeg operations)                                  │
│    video-audio-mcp (audio processing)                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Sandboxed Execution (E2B SDK / Docker)             │
│                                                                 │
│  FFmpeg ────────────────────► 80% of editing operations        │
│  MoviePy 2.x ───────────────► Timeline / compositing           │
│  Remotion (serverless) ─────► Motion graphics / titles         │
│  Blender headless ──────────► 3D VFX (optional, batch)         │
│                                                                 │
│  Output → S3/R2 → presigned URL → LiveKit video track preview  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Recommended Tech Stack Per Layer

| Layer | Recommended | Rationale |
|---|---|---|
| Voice input | LiveKit STT (existing) | Already integrated |
| LLM orchestration | Claude claude-sonnet-4-6 tool use | Best code gen + tool use fidelity |
| Agent framework | Pipecat | Purpose-built for voice + tool pipelines |
| Simple edits | FFmpeg via `ffmpeg-python` | Fast, reliable, no Python overhead |
| Complex compositions | MoviePy 2.x | Pythonic, LLM-friendly |
| Motion graphics | Remotion (Lambda) | Native React, server-side renders |
| 3D VFX | Blender headless | For advanced/batch use cases only |
| Code execution | E2B Sandbox | Secure, fast boot, Python + FFmpeg preinstalled |
| Preview delivery | LiveKit video track | Already in `video-tile.tsx` |
| Storage | Cloudflare R2 / S3 | Video file management |

### 6.3 Agent Tool Skeleton (Python)

```python
from livekit.agents import function_tool
import asyncio, subprocess, tempfile

@function_tool
async def edit_video(ctx, description: str, input_path: str) -> str:
    """
    Edit a video based on a natural language description.
    Supports: trim, crop, color grade, speed change, add text,
    chroma key, concat, transitions, audio adjustments.
    Returns presigned URL to preview the result.
    """
    # Step 1: LLM generates FFmpeg command
    ffmpeg_cmd = await ctx.llm.generate(
        f"Generate an FFmpeg command to: {description}\n"
        f"Input file: {input_path}\n"
        f"Output file: /tmp/output.mp4\n"
        f"Return ONLY the ffmpeg command, nothing else."
    )

    # Step 2: Execute in sandbox with error feedback loop
    for attempt in range(3):
        result = subprocess.run(ffmpeg_cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            break
        # Step 3: Feed error back to LLM for correction
        ffmpeg_cmd = await ctx.llm.generate(
            f"This FFmpeg command failed:\n{ffmpeg_cmd}\n"
            f"Error: {result.stderr}\n"
            f"Fix the command and return ONLY the corrected command."
        )

    return await upload_and_get_url("/tmp/output.mp4")

@function_tool
async def add_vfx(
    ctx,
    effect_description: str,
    input_path: str,
    start_time: float,
    end_time: float
) -> str:
    """
    Add a visual effect to a time range.
    Supports: color grade, blur, glow, chromatic aberration,
    lower-thirds, particle effects, chroma key, vignette.
    """
    ...
```

---

## 7. Implementation Roadmap

### Phase 1 — Structural Edits MVP (2–3 weeks)
- [ ] Add video upload panel to the UI
- [ ] Implement `edit_video` tool in the LiveKit Python agent (FFmpeg backend)
- [ ] Support: trim, concat, crop, speed change, add text overlay, format conversion
- [ ] Stream preview via existing LiveKit video track (`video-tile.tsx`)
- [ ] Conversational loop: "trim seconds 5–15" → preview → confirm / undo

### Phase 2 — VFX Layer (2–3 weeks)
- [ ] FFmpeg effect library: chroma key, LUT color grade, vignette, transitions
- [ ] MoviePy integration for timeline composition and multi-clip assembly
- [ ] Remotion component generator for motion graphics and lower-thirds
- [ ] Undo/redo via edit history (each step is a saved script)
- [ ] GLSL shader VFX in the browser via VFX-JS for live preview effects

### Phase 3 — Advanced (ongoing)
- [ ] Blender headless integration for 3D VFX (particle systems, physics)
- [ ] OpenCV scene understanding for spatial voice commands ("the logo in top-right")
- [ ] Generative AI integration (Runway/Pika API) as additional tools
- [ ] Multi-clip project model with timeline view
- [ ] Export to multiple formats and aspect ratios

---

## 8. Conclusion

Code-powered video editing for an AI voice agent is **technically feasible today** with a clear, proven architecture. Key findings:

1. **LLM → FFmpeg is the most mature path** — multiple open-source tools (llmpeg, vfx-mcp) already ship this pattern
2. **AutoVFX (2024) proved the full chain** — LLM → Blender Python → photorealistic VFX — produces production-quality results
3. **MCP ecosystem provides ready-made tool servers** — vfx-mcp, video-audio-mcp can be integrated immediately
4. **Pipecat is the missing orchestration layer** — purpose-built for voice + LLM + tool pipelines with LiveKit transport
5. **Remotion is native to this React project** — motion graphics generation fits without any new technology
6. **a16z declared 2026 the year agentic video editing goes mainstream** — infrastructure is ready

The primary risk is latency on complex operations — mitigated by using FFmpeg as the primary engine and working on short clips for real-time previews. The primary differentiator of this approach over GUI-based editors is **voice-native UX** and **reproducible, version-controlled edits**.

---

## Sources

- [AutoVFX paper (arXiv, Nov 2024)](https://arxiv.org/abs/2411.02394)
- [AutoVFX project site](https://haoyuhsu.github.io/autovfx-website/)
- [a16z: It's time for agentic video editing](https://a16z.com/its-time-for-agentic-video-editing/)
- [vfx-mcp GitHub](https://github.com/connerohnesorge/vfx-mcp)
- [video-audio-mcp GitHub](https://github.com/misbahsy/video-audio-mcp)
- [llmpeg by gstrenge](https://github.com/gstrenge/llmpeg)
- [wtffmpeg by scottvr](https://github.com/scottvr/wtffmpeg)
- [Pipecat framework](https://github.com/pipecat-ai/pipecat)
- [MoviePy 2.0 docs](https://zulko.github.io/moviepy/)
- [MovieLite (Numba-accelerated)](https://github.com/francozanardi/movielite)
- [Remotion documentation](https://www.remotion.dev/)
- [Blender Python API](https://docs.blender.org/api/current/)
- [Blendify high-level Blender Python wrapper](https://github.com/ptrvilya/blendify)
- [VFX-JS WebGL effects (Codrops, Jan 2025)](https://tympanus.net/codrops/2025/01/20/vfx-js-webgl-effects-made-easy/)
- [E2B Sandbox SDK](https://e2b.dev/docs)
- [DaVinci Resolve Scripting API v20.3](https://gist.github.com/X-Raym/2f2bf453fc481b9cca624d7ca0e19de8)
- [Video Editing MCP Servers (aibase)](https://mcp.aibase.com/tag/Video%20Editing)
- [Claude + Remotion AI video (DEV Community)](https://dev.to/mayu2008/new-clauderemotion-to-create-amazing-videos-using-ai-37bp)
- [Building an easier FFmpeg with LLMs (dbreunig.com, Feb 2025)](https://www.dbreunig.com/2025/02/24/building-an-easier-to-use-ffmpeg-with-llm.html)
- [LLM-based energy-efficient FFmpeg tool (ACM, 2024)](https://dl.acm.org/doi/pdf/10.1145/3715675.3715835)
- [DeepSeek Coder for multimedia editing (Medium)](https://medium.com/@jaimonjk/leveraging-open-source-llms-deepseek-coder-for-natural-language-based-multimedia-editing-2903917e3465)
- [NVIDIA RTX LTX-2 local 4K video generation (CES 2026)](https://blogs.nvidia.com/blog/rtx-ai-garage-ces-2026-open-models-video-generation/)
- [LiveKit Agents Python SDK](https://docs.livekit.io/agents/)
- [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html)
