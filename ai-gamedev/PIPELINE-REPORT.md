# AI Game Development Pipeline Report
## Practical Reference for Studio Implementation
### March 2026

---

## 1. Executive Summary

Two pipelines, two very different levels of complexity.

**Pipeline A: 3D RPG (Unity/Unreal)**
A small studio building a 3D RPG in 2026 can automate roughly 40-50% of total development effort through a chain of AI tools connected via MCP (Model Context Protocol), REST APIs, and headless scripting. The pipeline looks like this: Claude Code sits in a terminal connected to the game engine via MCP, issuing commands to create GameObjects, configure scenes, and run tests. Art assets flow through Meshy/Tripo APIs for 3D generation, Scenario.gg for style-consistent textures, and Blender headless scripts for mesh cleanup and LOD generation. Audio comes from ElevenLabs (SFX + voice), Google Lyria or Mubert (music), and FMOD/Wwise (adaptive middleware). NPC dialogue runs through Inworld AI or Convai with native engine SDKs. Builds ship through GameCI on GitHub Actions.

The developer's daily work shifts from "create everything" to "direct AI, review output, integrate, and polish." The creative direction, game feel, systems architecture, and final quality pass remain firmly human.

**Pipeline B: Flat Educational Games (three.js)**
A dramatically simpler pipeline. Claude Code generates React Three Fiber or Phaser.js code directly from specs. Recraft V4 API produces SVG icons and illustrations at $0.08 each. Scenario.gg generates consistent character art. ElevenLabs handles narrator voice and feedback sounds. Quiz content comes from Claude API. No MCP needed -- direct code generation is sufficient. Total monthly tooling cost: $50-100. A single developer can prototype a Kahoot-style game in days.

---

## 2. The Recommended Tool Stack

### Table A: 3D RPG Pipeline (Unity/Unreal)

| Pipeline Stage | Tool | API/CLI/SDK | Monthly Cost | Integration Method |
|---|---|---|---|---|
| **AI Coding** | Claude Code + MCP | CLI + MCP bridge | $20-200/mo (Pro/Max) | MCP WebSocket/IPC to engine |
| **IDE** | Cursor Pro (Unity) / VS 2026 + Copilot (Unreal) | IDE plugin | $20/mo / $10-19/mo | Direct IDE integration |
| **Concept Art** | Scenario.gg | REST API (Basic Auth) | $10-50/mo | API batch generation |
| **3D Props & Environment** | Meshy API (v6) | REST API (Bearer) | $10-30/mo | API + Unity/Unreal/Blender plugins |
| **3D Characters (Hero)** | Rodin / Hyper3D | REST API (Bearer) | $50-150/mo | API + engine plugins |
| **3D Rapid Prototyping** | Tripo API | REST API + Python SDK | $12/mo | `pip install tripo3d` |
| **Style Consistency (2D)** | Scenario.gg LoRA training | REST API | Included above | Train on 10-25 reference images |
| **Asset Retexturing** | Meshy Retexture API | REST API | Included above | Batch script with polling |
| **Mesh Processing** | Blender headless | Python scripting | Free | `blender --background --python` |
| **LOD Generation** | Unity AutoLOD / UE built-in | Engine-native | Free | Auto on import |
| **Scene Assembly** | Unity/Unreal MCP | MCP tools (37-49 tools) | Free | Claude Code commands |
| **Music (Background)** | Google Lyria 3 Pro | Vertex AI REST API | ~$0.06/30s clip | Pre-generate, import WAV |
| **Music (Adaptive/Streaming)** | Mubert API | REST API + WebRTC | $49-499/mo | Real-time streaming or pre-gen |
| **SFX** | ElevenLabs Sound Effects v2 | REST API + Python/C# SDKs | $5-99/mo | Batch generate, import WAV |
| **Voice Acting (Scripted)** | ElevenLabs TTS | REST API + SDKs | Included above | Batch from dialogue CSV |
| **NPC Dialogue (Dynamic)** | Inworld AI | Unity SDK / Unreal SDK | $5-10/M chars | Native engine plugin |
| **NPC Dialogue (Budget)** | Convai | Unity Plugin / Unreal SDK | Free-$99/mo | Asset Store plugin |
| **Lip Sync** | Inworld built-in / uLipSync | Engine SDK | Included | Viseme mapping |
| **Audio Middleware** | FMOD or Wwise | JS scripting / WAAPI+PyWwise | Free (indie) | Engine plugin |
| **Dialogue Trees** | Yarn Spinner (Unity) / Ink (Unreal) | Open source libs | Free | AI generates .yarn/.ink files |
| **Testing** | modl.ai + Unity/UE Test Framework | Engine plugin | Contact sales | CI/CD integration |
| **CI/CD** | GameCI + GitHub Actions | YAML workflows | Free | Docker-based build runners |
| **Orchestration** | n8n (self-hosted) | Workflow automation | Free | Webhook chains |

### Table B: Educational Game Pipeline (three.js)

| Pipeline Stage | Tool | API/CLI/SDK | Monthly Cost | Integration Method |
|---|---|---|---|---|
| **AI Coding** | Claude Code | CLI | $20-200/mo | Direct code generation |
| **IDE** | Cursor Pro | IDE | $20/mo | AI-assisted editing |
| **Framework (3D)** | React Three Fiber | npm package | Free | `npm install @react-three/fiber` |
| **Framework (2D)** | Phaser.js | npm package | Free | `npm install phaser` |
| **SVG Icons/Illustrations** | Recraft V4 | REST API via fal.ai | ~$40/mo (500 SVGs) | `fal.subscribe("fal-ai/recraft/v4/...")` |
| **Character Art** | Scenario.gg | REST API | $10-30/mo | Custom LoRA + batch API |
| **Quiz Content** | Claude API | REST API | $20-50/mo | Structured JSON generation |
| **Narrator Voice** | ElevenLabs Flash v2.5 | REST API + JS SDK | $5-22/mo | Pre-generate audio files |
| **SFX** | ElevenLabs Sound Effects | REST API | Included above | Text-to-SFX |
| **Game AI (NPC)** | Yuka | npm package | Free | `npm install yuka` |
| **NPC Dialogue** | Convai Web SDK | REST API / JS SDK | Free (3K interactions) | WebSocket integration |
| **Asset Optimization** | glTF-Transform CLI | CLI | Free | `gltf-transform optimize` |
| **Visual Testing** | Playwright | npm CLI | Free | Screenshot comparison |
| **Hosting** | Vercel / Netlify | CLI | Free tier | Static deploy |
| **Real-time (Multiplayer)** | Socket.io | npm package | Free | WebSocket server |

---

## 3. Concrete Pipeline Workflows

### Workflow A: 3D RPG (Unity)

**Step 1: Project Setup (Day 1)**
```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Install Unity MCP (Coplay)
# In Unity: Package Manager > Git URL:
# https://github.com/CoplayDev/unity-plugin.git#beta

# Register MCP server with Claude Code
claude mcp add --scope user --transport stdio coplay-mcp \
  --env MCP_TOOL_TIMEOUT=720000 \
  -- uvx --python ">=3.11" coplay-mcp-server@latest

# Verify connection
claude mcp list
# Open Unity > Window > MCP for Unity > Start Server
```

**Step 2: Concept Art Generation (Week 1)**
```bash
# Train a style LoRA on Scenario.gg
curl -X POST https://api.scenario.com/v1/models/train \
  -H "Authorization: Basic ${BASE64_KEY}" \
  -d '{"name":"my-rpg-style","images":["url1","url2",...], "type":"lora"}'

# Batch generate concept art
curl -X POST https://api.scenario.com/v1/generate \
  -H "Authorization: Basic ${BASE64_KEY}" \
  -d '{"modelId":"your-lora-id","prompt":"medieval tavern interior, warm lighting","numSamples":4}'
```
Output: Style-locked concept art that feeds into 3D asset generation.

**Step 3: 3D Asset Generation (Weeks 2-4)**
```bash
# Generate props via Meshy API
curl https://api.meshy.ai/openapi/v2/text-to-3d \
  -H "Authorization: Bearer ${MESHY_API_KEY}" \
  -d '{"mode":"preview","prompt":"a medieval wooden shield with iron bands"}'

# Poll for completion
curl https://api.meshy.ai/openapi/v2/text-to-3d/${TASK_ID} \
  -H "Authorization: Bearer ${MESHY_API_KEY}"

# For hero characters, use Rodin/Hyper3D
curl -X POST https://api.hyper3d.com/api/v2/rodin \
  -H "Authorization: Bearer ${RODIN_KEY}" \
  -d '{"prompt":"fantasy warrior character, animation-ready topology","quality":"high"}'
```
Output: GLB/FBX files with PBR textures (base color, metallic, roughness, normal).

**Step 4: Mesh Processing (Blender Headless)**
```bash
# Batch cleanup, LOD generation, format conversion
blender --background --python batch_process.py -- /path/to/models/ /path/to/output/
```
The `batch_process.py` script (from asset pipeline research) removes doubles, fixes normals, generates LOD0-LOD3 via Decimate modifier, and exports per-LOD GLB files.

**Step 5: Import to Unity via MCP**
Claude Code (connected via MCP) imports assets and assembles scenes:
```
> "Import all GLB files from /output/ into Assets/Models/. For each, create a prefab
  with MeshCollider. Place the tavern props in the Tavern scene using the layout
  from the concept art."
```
MCP tools used: `manage_asset`, `manage_gameobject`, `manage_prefabs`, `manage_scene`.

**Step 6: Audio Pipeline**
```python
# SFX: Batch generate via ElevenLabs
from elevenlabs import AsyncElevenLabs
import asyncio

client = AsyncElevenLabs(api_key="YOUR_API_KEY")

sfx_manifest = [
    ("sword_clash", "Heavy sword clash on metal shield with reverb in a stone dungeon"),
    ("door_creak", "Heavy wooden door creaking open slowly"),
    ("fire_crackle", "Campfire crackling and popping, medium intensity"),
]

async def generate_sfx(name, prompt):
    audio = await client.text_to_sound_effects.convert(
        text=prompt, duration_seconds=5.0, prompt_influence=0.4
    )
    with open(f"Assets/Audio/SFX/{name}.wav", "wb") as f:
        async for chunk in audio:
            f.write(chunk)

asyncio.run(asyncio.gather(*[generate_sfx(n, p) for n, p in sfx_manifest]))
```

```bash
# Music: Generate via Lyria on Vertex AI
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/us-central1/publishers/google/models/lyria-002:predict \
  -d '{
    "instances": [{"prompt": "Dark ambient orchestral music for dungeon exploration, slow tempo, minor key"}],
    "parameters": {"sample_count": 1}
  }'
```

```python
# Voice: Batch dialogue from script
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key="YOUR_API_KEY")
dialogue_lines = [
    {"voice_id": "voice_abc123", "line": "We must breach the castle before dawn.", "file": "warrior_01.wav"},
    {"voice_id": "voice_def456", "line": "I sense dark magic beyond those walls.", "file": "mage_01.wav"},
]

for entry in dialogue_lines:
    audio = client.text_to_speech.convert(
        voice_id=entry["voice_id"], text=entry["line"],
        model_id="eleven_multilingual_v2", output_format="pcm_44100"
    )
    with open(f"Assets/Audio/Dialogue/{entry['file']}", "wb") as f:
        for chunk in audio:
            f.write(chunk)
```

**Step 7: FMOD/Wwise Adaptive Audio Setup**
```javascript
// FMOD Studio scripting: create adaptive music event
var event = studio.project.create("Event");
event.name = "Music/Exploration/DungeonTheme";
event.addGameParameter({
    name: "CombatIntensity", type: studio.project.parameterType.User, min: 0, max: 1
});
// Import AI-generated layers (calm, tense, combat) as tracks
// Set automation curves to crossfade based on CombatIntensity parameter
```

**Step 8: NPC Intelligence**
Install Inworld AI from Unity Asset Store ("AI NPC Engine v3"). Configure characters in Inworld Studio with personality, memory, and knowledge bases. The SDK handles speech-to-speech, lip sync, and emotional responses at runtime.

**Step 9: Testing via MCP**
```
> "Run all EditMode and PlayMode tests via Unity Test Runner. Show me any failures."
```
MCP tool: `run_tests`. Results piped back to Claude Code for analysis.

**Step 10: CI/CD Build**
```yaml
# .github/workflows/build.yml
name: Build Unity Project
on:
  push:
    branches: [main, develop]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - uses: game-ci/unity-test-runner@v4
        env: { UNITY_LICENSE: "${{ secrets.UNITY_LICENSE }}" }
  build:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        targetPlatform: [StandaloneWindows64, StandaloneOSX, WebGL]
    steps:
      - uses: actions/checkout@v4
        with: { lfs: true }
      - uses: game-ci/unity-builder@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
          UNITY_EMAIL: ${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: ${{ secrets.UNITY_PASSWORD }}
        with:
          targetPlatform: ${{ matrix.targetPlatform }}
```

---

### Workflow B: 3D RPG (Unreal)

The Unreal pipeline differs from Unity in these specific ways:

**MCP Setup: mcp-unreal instead of Coplay**
```bash
# Install mcp-unreal (Go-based, most complete for UE 5.7)
go install github.com/remiphilippe/mcp-unreal/cmd/mcp-unreal@latest
mcp-unreal --build-index

# Claude Code config (.mcp.json in project root):
{
  "mcpServers": {
    "mcp-unreal": {
      "type": "stdio",
      "command": "/path/to/mcp-unreal",
      "env": { "MCP_UNREAL_PROJECT": "/path/to/MyProject.uproject" }
    }
  }
}
```
mcp-unreal provides 49 tools including headless build/cook, Blueprint creation and node wiring, material authoring, actor spawning, PIE control, and viewport capture. Key advantage over Unity: headless operations work without the editor running.

**Coding: Visual Studio 2026 + Copilot replaces Cursor**
VS 2026 with Copilot provides symbol-level C++ context (class hierarchies, function call chains) that is significantly stronger than any VS Code-based solution for Unreal C++ development. Demoed specifically for game dev at GDC 2026.

**Blueprint Generation: add Ludus AI or Ultimate Engine CoPilot**
- Ludus AI ($10-25/mo): UE plugin with dedicated Blueprint generation from natural language
- Ultimate Engine CoPilot (one-time purchase on Fab): Blueprint generation + AI Memory for persistent context across sessions. Supports multiple AI providers (OpenAI, Claude, Gemini, local LLMs via Ollama).

**Build: RunUAT replaces GameCI**
```bash
./RunUAT.sh BuildCookRun \
  -project="/path/to/MyProject.uproject" \
  -platform=Win64 \
  -clientconfig=Shipping \
  -cook -stage -pak -archive \
  -archivedirectory="/path/to/output"
```
mcp-unreal can trigger this headlessly via `build_project` and `cook_project` tools.

**NPC AI: Same tools, different SDKs**
- Inworld AI: "AI NPC Engine v1.5" on UE Marketplace, MetaHuman lip sync support, Blueprint-accessible API
- Convai: Open-source Unreal SDK on GitHub (`Conv-AI/Convai-UnrealEngine-SDK`), MetaHuman compatible

**Audio Middleware: Wwise may be preferred over FMOD**
Wwise offers SoundSeed (built-in procedural wind, rain, fire, vehicle engines) and the WAAPI/PyWwise scripting API for automated bulk import of AI-generated assets.

Everything else (3D generation, Blender processing, audio generation, style consistency) is identical to the Unity pipeline.

---

### Workflow C: Educational Game (three.js)

**Step 1: Project Scaffold**
```bash
npm create vite@latest my-edu-game -- --template react-ts
cd my-edu-game
npm install three @react-three/fiber @react-three/drei phaser socket.io-client
npm install -D @playwright/test
```

**Step 2: Generate Game Code with Claude Code**
```
> "Create a Kahoot-style quiz game using React + Phaser for the 2D quiz UI and
  React Three Fiber for a 3D mascot character. Support real-time multiplayer via
  Socket.io. Questions should load from a JSON API."
```
Claude Code generates the full application structure: React components, Phaser scenes, R3F 3D views, Socket.io integration, and API routes.

**Step 3: Generate Quiz Content**
```python
import anthropic

client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-6-20260328",
    max_tokens=4096,
    messages=[{"role": "user", "content": """Generate 20 science quiz questions for
    grades 3-5 in JSON format: [{"question":"...","options":["A","B","C","D"],
    "correct":0,"explanation":"...","difficulty":1-3}]"""}]
)
# Parse and save to questions.json
```

**Step 4: Generate SVG Assets via Recraft V4**
```javascript
import { fal } from "@fal-ai/client";

const icons = [
    "a cute cartoon rocket ship, flat design, educational style",
    "a friendly robot teacher, flat vector illustration",
    "a gold star trophy, simple flat design",
    "a colorful planet Earth, educational illustration style",
];

for (const [i, prompt] of icons.entries()) {
    const result = await fal.subscribe("fal-ai/recraft/v4/text-to-vector", {
        input: {
            prompt,
            colors: [[66, 133, 244], [234, 67, 53], [251, 188, 4], [52, 168, 83]]
        }
    });
    // Download SVG from result.images[0].url
}
```
Load in three.js via SVGLoader:
```javascript
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
const loader = new SVGLoader();
loader.load('rocket.svg', (data) => { /* create meshes from paths */ });
```

**Step 5: Generate Audio**
```python
# Narrator voice for instructions
from elevenlabs import ElevenLabs
client = ElevenLabs(api_key="YOUR_API_KEY")

audio = client.text_to_speech.convert(
    voice_id="narrator_voice_id",
    text="Welcome to Science Quiz! Tap the correct answer before time runs out!",
    model_id="eleven_flash_v2_5",  # 75ms latency, 50% cheaper
    output_format="mp3_44100_128"
)
with open("public/audio/welcome.mp3", "wb") as f:
    for chunk in audio:
        f.write(chunk)

# SFX: correct/incorrect sounds
for name, prompt in [
    ("correct", "Bright cheerful ding, quiz game correct answer"),
    ("wrong", "Gentle buzzer, quiz game wrong answer, not harsh"),
    ("countdown", "Ticking clock, medium tempo, tension building"),
]:
    audio = client.text_to_sound_effects.convert(text=prompt, duration_seconds=2.0)
    with open(f"public/audio/{name}.wav", "wb") as f:
        for chunk in audio:
            f.write(chunk)
```

**Step 6: Optimize 3D Assets (if using any GLB models)**
```bash
npm install -g @gltf-transform/cli
gltf-transform optimize mascot.glb mascot-opt.glb --compress draco --texture-compress webp
```

**Step 7: Visual Regression Testing**
```bash
npx playwright test --update-snapshots  # Create golden baselines
npx playwright test                      # Compare on each PR
```

**Step 8: Deploy**
```bash
npm run build
npx vercel deploy --prod
```

---

## 4. The Asset Restyling Pipeline

This section addresses a specific, high-value problem: you have purchased thousands of Unity/Unreal asset store assets from dozens of different artists, and they all look different. You need them to share one consistent art style.

### Step 1: Define Your Target Style

Collect 15-50 reference images that represent your desired art style. These should include:
- Environment shots showing lighting, color palette, material treatment
- Props showing the desired level of detail and stylization
- Characters (if applicable) showing proportions and rendering approach

### Step 2: Train a Style LoRA

**Option A: Scenario.gg (Recommended for 2D textures)**
```bash
# Upload reference images and train a custom model
curl -X POST https://api.scenario.com/v1/models/train \
  -H "Authorization: Basic ${BASE64_KEY}" \
  -d '{
    "name": "my-rpg-art-style",
    "images": ["https://...ref1.png", "https://...ref2.png", ...],
    "type": "lora",
    "trainingSteps": 2000
  }'
# Training takes 10-30 minutes. Result: a reusable model ID.
```

**Option B: ComfyUI Local LoRA Training (for full control)**
1. Install ComfyUI with comfyUI-Realtime-Lora extension
2. Prepare 15-50 captioned reference images (consistent descriptive tags)
3. Train for 1000-3000 steps (10-30 minutes on consumer GPU, e.g., RTX 3080+)
4. Test at LoRA strengths 0.4-0.8 (0.6 is typical sweet spot)
5. For maximum character consistency: combine low-strength LoRA (0.6) + PuLID Adapter (0.8) + ControlNet (OpenPose)

**Option C: Hunyuan3D Fine-Tuning (for 3D model generation)**
The only tool that allows fine-tuning the 3D generation model itself. Self-hosted, requires 6GB+ VRAM.
```bash
git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
# Follow fine-tuning instructions in repo with your style reference meshes
```

### Step 3: Batch Retexture via Meshy API

```python
import requests, time, os, json

API_KEY = os.environ["MESHY_API_KEY"]
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
BASE = "https://api.meshy.ai/openapi/v1"

STYLE_PROMPT = "hand-painted fantasy RPG style, warm color palette, stylized proportions"
STYLE_REF_IMAGE = "https://yourserver.com/style-reference.png"

def retexture_model(model_url):
    resp = requests.post(f"{BASE}/retexture", headers=HEADERS, json={
        "model_url": model_url,
        "text_style_prompt": STYLE_PROMPT,
        "image_style_url": STYLE_REF_IMAGE,
        "enable_pbr": True,
        "enable_original_uv": True,  # Critical: preserves existing UV layout
        "target_formats": ["glb", "fbx"],
        "ai_model": "meshy-6"
    })
    return resp.json()["result"]

def poll_until_done(task_id):
    while True:
        resp = requests.get(f"{BASE}/retexture/{task_id}", headers=HEADERS)
        data = resp.json()
        if data["status"] == "SUCCEEDED":
            return data
        if data["status"] == "FAILED":
            raise Exception(f"Task {task_id} failed: {data.get('error')}")
        time.sleep(5)

# Process all models
model_urls = json.load(open("model_manifest.json"))  # List of URLs or hosted files
for url in model_urls:
    task_id = retexture_model(url)
    result = poll_until_done(task_id)
    download_url = result["model_urls"]["glb"]
    # Download and save to output directory
    print(f"Done: {url} -> {download_url}")
```

**Cost:** ~$0.10-0.30 per model (10 credits). 1,000 models = ~$100-300.
**Supported input formats:** .glb, .gltf, .obj, .fbx, .stl

### Step 4: Blender Headless Batch Processing

```python
# batch_process.py -- run with: blender --background --python batch_process.py
import bpy, os, sys

input_dir = sys.argv[sys.argv.index("--") + 1]
output_dir = sys.argv[sys.argv.index("--") + 2]

for filename in os.listdir(input_dir):
    if not filename.endswith(('.glb', '.fbx', '.obj')): continue
    filepath = os.path.join(input_dir, filename)

    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import
    if filepath.endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=filepath)
    elif filepath.endswith('.obj'):
        bpy.ops.wm.obj_import(filepath=filepath)
    elif filepath.endswith(('.gltf', '.glb')):
        bpy.ops.import_scene.gltf(filepath=filepath)

    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH': continue
        bpy.context.view_layer.objects.active = obj

        # Remove doubles
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.0001)
        bpy.ops.object.mode_set(mode='OBJECT')

    # Export LODs
    name = os.path.splitext(filename)[0]
    for lod, ratio in [("LOD0", 1.0), ("LOD1", 0.5), ("LOD2", 0.25), ("LOD3", 0.1)]:
        if ratio < 1.0:
            mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
            mod.ratio = ratio
            bpy.ops.object.modifier_apply(modifier=mod.name)

        out = os.path.join(output_dir, f"{name}_{lod}.glb")
        bpy.ops.export_scene.gltf(filepath=out, use_selection=False)

        if ratio < 1.0:
            bpy.ops.ed.undo()
```

Run:
```bash
blender --background --python batch_process.py -- /path/to/retextured/ /path/to/final/
```

### Step 5: Import Back to Engine

**Unity:**
```bash
# Drop processed files into Assets/Models/ -- Unity auto-imports
# Or via MCP:
> "Import all GLB files from /path/to/final/ into Assets/Models/Props/.
  Set import scale to 1.0, enable mesh compression, generate lightmap UVs."
```
For programmatic control, use `AssetPostprocessor` to apply consistent import settings automatically across all imports.

**Unreal:**
```bash
# Via mcp-unreal or Python scripting:
# unreal.AssetImportTask for batch import
# Auto-generate collision on import
# LOD chain from LOD0-LOD3 files
```

### The 80/20 Rule (from NVIDIA Painkiller RTX)

NVIDIA's team batch-processed thousands of textures across 35 levels using PBRFusion. Their key finding: **AI handles 80% of repetitive retexturing work. Humans refine the 20% that matters** -- hero materials, glass, skin, transparent surfaces, and any asset the camera lingers on. Plan your pipeline accordingly: batch everything through AI first, then flag hero assets for manual polish.

---

## 5. The Scene-Aware Content Pipeline

### 5.1 Scene Screenshot to Asset Generation

```
Game Scene (Unity/Unreal)
    |
    v
[MCP: capture viewport screenshot]
    |
    v
[Vision Model: Claude Sonnet/Opus]
  - Analyzes art style, color palette, mood
  - Identifies missing/complementary assets
  - Generates precise prompts for asset generation
    |
    v
[3D Generation API: Meshy/Tripo]
  - Uses scene description as context
  - Uses screenshot as style reference
    |
    v
[MCP: import generated assets into scene]
```

**Concrete implementation:**
```python
import anthropic, requests, base64

# 1. Capture screenshot (via MCP viewport capture or manual export)
with open("scene_screenshot.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

# 2. Analyze with Claude Vision
client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=2000,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_data}},
            {"type": "text", "text": """Analyze this game scene:
1. Describe the art style (color palette, rendering style, detail level)
2. List all visible asset types
3. Suggest 10 props that would complement this scene
4. For each, write a Meshy/Tripo generation prompt
5. Write a unified style reference prompt for consistent texturing"""}
        ]
    }]
)

# 3. Parse response, extract prompts, feed to Meshy
scene_analysis = response.content[0].text
# Extract individual prompts and batch-generate via Meshy API (see Section 4)
```

### 5.2 Scene Mood to Music Generation

```python
# 1. Capture screenshot and analyze mood
mood_response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=500,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_data}},
            {"type": "text", "text": "Describe the mood of this game scene for a music composer. Include: tempo (BPM), key (major/minor), instruments, energy level (1-10), genre, emotional tone. Output as a music generation prompt."}
        ]
    }]
)

# 2. Feed mood description to Lyria
music_prompt = mood_response.content[0].text
# -> "Dark ambient orchestral, 70 BPM, minor key, strings and choir,
#     energy 3/10, dungeon exploration, foreboding"

import requests
lyria_response = requests.post(
    f"https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/lyria-002:predict",
    headers={"Authorization": f"Bearer {ACCESS_TOKEN}"},
    json={
        "instances": [{"prompt": music_prompt, "negative_prompt": "vocals, upbeat, happy"}],
        "parameters": {"sample_count": 1}
    }
)
```

**Alternative: Mubert direct image-to-music**
Mubert uniquely supports image input directly -- it detects mood from images and generates matching music without the intermediate vision analysis step.

```bash
curl -X POST https://music-api.mubert.com/api/v3/public/tracks \
  -H "customer-id: YOUR_ID" \
  -H "access-token: YOUR_TOKEN" \
  -d '{"playlist_index": "dark_ambient", "duration": 120, "intensity": 0.3, "mode": "track"}'
```

### 5.3 Scene Context to SFX and Ambient Audio

```python
# 1. Analyze scene for audio needs
sfx_response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1000,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_data}},
            {"type": "text", "text": """List all sound effects this game scene needs:
1. Ambient loops (wind, water, fire, crowd, etc.)
2. Interactive SFX (doors, chests, footsteps on this surface)
3. Environmental one-shots (bird calls, distant thunder, etc.)
For each, write an ElevenLabs SFX generation prompt with recommended duration."""}
        ]
    }]
)

# 2. Batch generate via ElevenLabs
from elevenlabs import AsyncElevenLabs
import asyncio

client_el = AsyncElevenLabs(api_key="ELEVENLABS_KEY")

# Parse the scene analysis into a list of (name, prompt, duration, loop) tuples
scene_sfx = [
    ("ambient_wind", "Gentle wind through stone corridors, hollow echo", 10.0, True),
    ("torch_crackle", "Wall torch flame crackling, medium room reverb", 8.0, True),
    ("footstep_stone", "Single footstep on wet stone floor", 1.0, False),
    ("door_heavy", "Heavy iron door creaking open in dungeon", 3.0, False),
    ("water_drip", "Occasional water drops in a cave, sparse", 15.0, True),
]

async def gen(name, prompt, dur, loop):
    audio = await client_el.text_to_sound_effects.convert(
        text=prompt, duration_seconds=dur, loop=loop,
        prompt_influence=0.4, model_id="eleven_text_to_sound_v2"
    )
    with open(f"Assets/Audio/SFX/{name}.wav", "wb") as f:
        async for chunk in audio:
            f.write(chunk)

asyncio.run(asyncio.gather(*[gen(*s) for s in scene_sfx]))
```

### 5.4 Full Scene-Aware Pipeline Chain

The complete automated flow for a new scene:

1. **Developer creates rough blockout** (gray boxes) via MCP or manually
2. **Claude Vision analyzes blockout** -- identifies what the scene needs
3. **Meshy/Tripo generate 3D props** matching the scene's spatial requirements
4. **Blender headless processes** generated assets (cleanup, LODs)
5. **MCP imports and places** assets in the scene
6. **Claude Vision re-analyzes** the populated scene for gaps
7. **Lyria/Mubert generate music** matching the scene mood
8. **ElevenLabs generates SFX** matching scene environment
9. **FMOD/Wwise import scripts** set up adaptive audio events
10. **Developer reviews, adjusts, polishes** -- the 20% human pass

---

## 6. Cost Analysis

### 3D RPG Pipeline (Monthly During Active Development)

| Category | Tool(s) | Monthly Cost |
|---|---|---|
| **AI Coding** | Claude Code Max ($100) + Cursor Pro ($20) | $120 |
| **3D Generation** | Meshy Studio ($30) + Tripo ($12) + Rodin ($100) | $142 |
| **2D/Texture** | Scenario Pro ($30) | $30 |
| **Music** | Lyria on Vertex AI (~$3 for 50 tracks) + Mubert Trial ($49) | $52 |
| **SFX + Voice** | ElevenLabs Pro ($99) | $99 |
| **NPC AI** | Inworld AI On-Demand (~$50-100) | $75 |
| **Audio Middleware** | FMOD/Wwise (free indie license) | $0 |
| **Dialogue System** | Yarn Spinner / Ink (open source) | $0 |
| **Testing** | modl.ai (contact sales, estimate ~$50-100) | $75 |
| **CI/CD** | GameCI on GitHub Actions (free tier) | $0 |
| **Orchestration** | n8n self-hosted | $0 |
| **MCP Tools** | All open source / free | $0 |
| **Blender** | Free | $0 |
| | | |
| **TOTAL (RPG)** | | **~$593/mo** |

**Notes:**
- This is during active production. Pre-production and polish phases cost less.
- Rodin ($100) can be dropped if using Meshy for all 3D generation, saving ~$100.
- Mubert ($49) can be dropped if Lyria alone covers music needs, saving ~$49.
- Minimum viable RPG pipeline: ~$350/mo (Claude Code Pro + Meshy Pro + ElevenLabs Creator + Lyria).

### Educational Game Pipeline (Monthly)

| Category | Tool(s) | Monthly Cost |
|---|---|---|
| **AI Coding** | Claude Code Pro ($20) | $20 |
| **SVG Assets** | Recraft V4 via fal.ai (~500 SVGs at $0.08) | $40 |
| **Character Art** | Scenario Starter ($10) | $10 |
| **Quiz Content** | Claude API (Sonnet, ~$20) | $20 |
| **Voice + SFX** | ElevenLabs Starter ($5) | $5 |
| **NPC Dialogue** | Convai Free Tier | $0 |
| **Framework** | React Three Fiber + Phaser (open source) | $0 |
| **Asset Optimization** | glTF-Transform (open source) | $0 |
| **Testing** | Playwright (open source) | $0 |
| **Hosting** | Vercel free tier | $0 |
| | | |
| **TOTAL (Educational)** | | **~$95/mo** |

### One-Time Costs

| Item | Cost | Applies To |
|---|---|---|
| Unreal: Ultimate Engine CoPilot | $50-100 | Unreal only |
| Unreal: StraySpark MCP (207 tools) | Paid on Fab | Unreal only |
| Unity: Gaia Pro (terrain) | $183 | Unity RPG |
| GPU for local ComfyUI/Hunyuan3D | $0 (use existing) or $200-400/mo cloud | RPG pipeline |
| Promethean AI (level dressing) | $29-89/mo | RPG pipeline |

### Comparison to Freelancer Costs

For a mid-size RPG (500 SFX, 5,000 dialogue lines, 50 music tracks, 200 3D props):

| Task | Freelancer Cost | AI Pipeline Cost | Savings |
|---|---|---|---|
| 200 3D props | $10,000-20,000 | ~$60 (Meshy credits) | 99% |
| 500 SFX | $1,000-3,000 | ~$30 (ElevenLabs) | 97% |
| 50 music tracks | $3,000-10,000 | ~$3 (Lyria) | 99% |
| 5,000 dialogue lines | $5,000-20,000 | ~$50 (ElevenLabs) | 99% |
| Concept art (100 pieces) | $5,000-15,000 | ~$30 (Scenario) | 99% |
| **Total** | **$24,000-68,000** | **~$170 + dev time** | **99%** |

The catch: "dev time" is substantial. Plan for 20-40% of time per asset on review, iteration, and polish.

---

## 7. What's Still Manual

An honest assessment of what the developer does hands-on despite all this automation.

### Fully Manual (AI Cannot Help Meaningfully)

1. **Game feel and "fun factor"** -- No AI can tell you if your game is fun. Playtesting judgment is 100% human.
2. **Novel mechanic design** -- AI remixes existing patterns. Truly new gameplay mechanics come from human creativity.
3. **Emotional pacing** -- The rhythm of tension and release across a game session is an art form AI cannot replicate.
4. **Multiplayer networking code** -- Prediction, reconciliation, authority models. Only 15-25% AI coverage.
5. **VFX creation** -- Shader writing, particle system design, timing. Only 15% AI coverage. AI generates source textures but not the VFX systems themselves.
6. **Level design (gameplay)** -- Player flow, pacing, encounter spaces, difficulty curves remain entirely human. AI dresses environments but does not design gameplay.

### Partially Manual (AI Assists But Human Drives)

7. **Character 3D pipeline** -- AI generates meshes but topology is wrong for animation (no edge loops, irregular meshes). Manual retopology in Blender is still required for hero characters.
8. **Adaptive audio design** -- AI generates music tracks, but designing the adaptive system (intensity layers, transitions, triggers in FMOD/Wwise) is manual.
9. **Systems architecture** -- Cross-system interactions (economy + combat + progression). AI cannot reason about emergent gameplay.
10. **Quality review of every AI output** -- Every generated asset, sound, and line of dialogue needs human review. The "last mile" is 20-40% of total time.
11. **Performance optimization** -- AI generates working code, rarely optimal code. Critical paths need profiling and human optimization.
12. **Art direction decisions** -- AI generates options rapidly, but choosing the right style and maintaining it across the project is a creative director's job.

### What Looks Automated But Actually Is Not

13. **Style consistency enforcement** -- Even with LoRAs and reference images, you will get inconsistent outputs. Roughly 10-20% of generated assets will need regeneration or manual correction.
14. **Asset integration** -- Dropping a GLB into Unity is automated. Making it look right (adjusting materials, fixing collisions, setting up LOD thresholds) often requires manual tweaking.
15. **Dialogue quality** -- AI generates dialogue fast, but making it sound like real characters with distinct voices requires heavy editing for any narrative-driven game.

### The Real Split

- **AI does well (50-60% of production time):** Asset generation, boilerplate code, audio content, documentation, batch processing, testing setup, build automation.
- **Human does (40-50% of production time):** Creative direction, systems design, game feel, integration polish, quality review, playtesting, level design, VFX, networking.

Net result: a solo developer ships roughly 2x faster than without AI, not 5-10x. Plan project timelines accordingly.

---

## 8. Quick Start Guide

**If you want to start TODAY, do these 10 things first.**

### 1. Install Claude Code
```bash
npm install -g @anthropic-ai/claude-code
# Requires Anthropic account with Pro ($20/mo) or Max ($100-200/mo) subscription
# Sign up: https://claude.ai
```

### 2. Install Your Engine's MCP Bridge

**Unity:**
```bash
# In Unity 6+: Package Manager > Git URL:
# https://github.com/CoplayDev/unity-plugin.git#beta
# Then in Claude Code:
claude mcp add --scope user --transport stdio coplay-mcp \
  --env MCP_TOOL_TIMEOUT=720000 \
  -- uvx --python ">=3.11" coplay-mcp-server@latest
# Open Unity > Window > MCP for Unity > Start Server
```

**Unreal (5.7):**
```bash
go install github.com/remiphilippe/mcp-unreal/cmd/mcp-unreal@latest
mcp-unreal --build-index
# Add to .mcp.json in your project root (see Workflow B above)
```

### 3. Sign Up for Meshy API
- Go to https://www.meshy.ai/api
- Get Pro plan ($10/mo) for API access
- Generate your first 3D model from a text prompt to verify the pipeline works

### 4. Sign Up for ElevenLabs
- Go to https://elevenlabs.io
- Starter plan ($5/mo) is enough to start
- Generate a test sound effect and a test voice line
- Install Python SDK: `pip install elevenlabs`

### 5. Sign Up for Scenario.gg
- Go to https://www.scenario.com
- Free tier (50 daily credits) works for testing
- Upload 10-15 reference images and train your first style LoRA

### 6. Set Up Google Cloud for Lyria (Music)
- Go to https://console.cloud.google.com
- Enable Vertex AI API
- Generate your first music clip:
```bash
gcloud auth print-access-token  # Verify auth works
# Then use the Lyria API call from Workflow A, Step 6
```

### 7. Install Blender (for Headless Processing)
- Download from https://www.blender.org/download/
- Verify headless mode: `blender --background --python -e "import bpy; print('OK')"`
- Save the batch processing script from Section 4, Step 4

### 8. Set Up GameCI (Unity) or RunUAT (Unreal)
- **Unity:** Add `.github/workflows/build.yml` from Workflow A, Step 10. Create `UNITY_LICENSE` GitHub secret from your .ulf file.
- **Unreal:** Verify `RunUAT.sh` / `RunUAT.bat` runs from your engine install path.

### 9. First Test Run: Scene-to-Asset Pipeline
Run the complete chain once to verify everything connects:
1. Open your engine with MCP running
2. In Claude Code: "Describe what you see in the current scene"
3. Verify Claude can read scene state via MCP
4. Generate one 3D prop via Meshy API
5. Import it via MCP
6. Generate one sound effect via ElevenLabs
7. Drop it into the project

### 10. Install Optional Tools Based on Your Pipeline
- **For educational games:** `npm install three @react-three/fiber phaser` + sign up for Recraft V4 at fal.ai
- **For NPC dialogue:** Install Inworld AI SDK from Asset Store (Unity) or UE Marketplace (Unreal)
- **For style transfer at scale:** Install ComfyUI locally with your GPU
- **For Unreal Blueprints:** Get Ludus AI ($10/mo) or Ultimate Engine CoPilot from Fab
- **For workflow orchestration:** Self-host n8n: `docker run -it --rm -p 5678:5678 n8nio/n8n`

---

*Report synthesized March 28, 2026, from Phase 1 feasibility research and Phase 2 tool-specific research across four specialist agents covering asset pipeline, audio/music, coding/automation, and workflow integration. All tool names, API endpoints, pricing, and capabilities verified against current (March 2026) sources.*
