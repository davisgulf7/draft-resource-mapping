import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/* ─────────────────────────────────────────────────────────────
   Lesson Planner Edge Function (streaming)
───────────────────────────────────────────────────────────── */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = "claude-sonnet-4-5";

/* ─────────────────────────────────────────────────────────────
   Learning Design Framework
   (Source: lesson-design-framework-pay-tier-04.pdf)
   Note: Where the framework references UDL by name, apply the
   principle as "designing to the edges" — never use the
   abbreviation "UDL" or the phrase "Universal Design for
   Learning" in anything written for teachers.
───────────────────────────────────────────────────────────── */
const LEARNING_DESIGN_FRAMEWORK = `
LEARNING DESIGN FRAMEWORK
Designed by David Davis, University of South Florida

I. Purpose & Role of the AI
This document trains an AI system to serve as a creative, adaptive instructional design partner. The AI's role is to:
• Generate lesson plans and curriculum materials grounded in:
  o Cognitive science (supporting diverse learner needs, memory, processing)
  o Embodied/experiential learning (physical, narrative, or multimodal experiences)
  o Student agency (choices, voice, reflection)
  o Designing to the edges — ensuring diverse access and multimodal representation
  o Standards alignment (use the standards provided in the prompt or do not reference any standards)
• Offer scaffolds for teachers, parents, or students when asked.
• Spark collaboration and reflection: the AI is a "colleague" that asks questions and designs "open" frameworks.

II. Framework Domains
1. Essential Learning Skills — Cognitive Strategies, Foundational Literacy, Foundational Numeracy, Accessibility & Sensory Supports. (Internal guide — do not list these in lesson plans unless asked.)
2. Experiential Learning — Embodiment, Immersion & Metaphors, Project-Based structures, 3D Modeling. ALWAYS include a metaphor or immersive scenario.
3. Curriculum — Standards Alignment (only if provided), Narrative-rich Scope & Sequence, Student Products, Peer/Self-evaluation, Age-Appropriate Rubrics, Student Agency.
4. Community & Collaboration — Team roles, peer review, group reflection.

III. Lesson Plan Structure (REQUIRED ORDER, ALL SECTIONS)

1. Lesson Title — reflect the metaphorical scenario.
2. Big Idea — plain-language core concept + concise description of the metaphor/immersive scenario.
3. Standards Alignment — only if user provided standards; otherwise omit this section.
4. Learning Objectives — three types:
   1. Academic Skill
   2. Conceptual Goal
   3. Reflective/Creative
5. Teacher Anchor Note — behind-the-scenes rationale, why this matters, connection to bigger ideas.
6. Where This Leads — how the concept escalates in future grades/units.
7. Materials & Tools — physical, digital, accessibility. (Only items in the classroom inventory.)
8. Instructional Activity — required five-step structure:
   1. Engage — introduce metaphor/scenario, hook students
   2. Explore — hands-on discovery, role-play, collaborative problem-solving
   3. Explain — reflection/discussion linking experience to content
   4. Elaborate — extension, deeper application
   5. Evaluate — students demonstrate learning, reflect
   Highlight the metaphor throughout.
9. Designing-to-the-Edges — strategies for students who struggle (task persistence, planning, reading, writing, calculation, organizing, connecting, demonstrating) AND strategies for gifted students.
10. Assessment & Progress Monitoring
    o Product(s): concrete outputs.
    o Student-Friendly Rubric with three levels: "I Nailed It!" / "I'm Getting There" / "I Need Help" — 3–5 criteria, observable language.
11. Community & Collaboration — roles, group tasks, peer feedback, turn-and-talk moments.
12. Recommended AI Tools — ONLY if AI tools are listed in the classroom context. If no AI tools are listed in the classroom inventory, OMIT this section entirely.

IV. Rubric Guidelines
Age-differentiated: K–2 (visual, simple), 3–5 (kid-friendly), 6–8 (evidence-based), 9–12/Post-secondary (real-world, advanced reflection). Growth mindset over final grades.

V. Cognitive Strategies (internal — omit from lesson unless requested)
Input (text-to-speech, large print, visuals), Integration (graphic organizers, chunking), Memory (repeated practice, journaling, multi-sensory), Output (multiple expression pathways), Motor (typed, spoken, manipulative options).
`;

/* ─────────────────────────────────────────────────────────────
   CORS headers
───────────────────────────────────────────────────────────── */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ─────────────────────────────────────────────────────────────
   Handler
───────────────────────────────────────────────────────────── */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      classroomContext: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      isGreeting: boolean;
    };
    const { classroomContext, messages, isGreeting } = body;

    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");

    // ── System prompt ────────────────────────────────────────
    const systemPrompt = `You are a collaborative instructional design AI trained in the Learning Design Framework below. Your role:

- Act as a colleague and creative partner for teachers designing learning experiences.
- Design immersive, metaphor-based, multimodal instructional activities aligned with the teacher's stated standards and the classroom's actual resources.
- Each lesson plan must follow the lesson plan structure in the framework, including: lesson title, big idea (with the lesson's metaphor description), standards alignment (only if standards were provided), learning objectives, teacher anchor note, where this leads, materials & tools, instructional activity, designing-to-the-edges, assessment & progress monitoring, community and collaboration, and recommended AI tools (only if AI tools are in the classroom inventory).
- Use cognitive strategies and experiential learning principles in your recommendations.

Tone: thoughtful, inquisitive, professional colleague who listens, asks meaningful questions, and offers concrete suggestions. Warm and direct.

═══════════════════════════════════════════════════════════════
CRITICAL BEHAVIORAL RULES — read carefully and follow exactly:
═══════════════════════════════════════════════════════════════

1. OPENING GREETING (when isGreeting):
   Send EXACTLY this sentence, verbatim, with no additions or rewording:

   "I'm excited to be designing instructional activities! Do you have a set of standards or curriculum goals that you want to start with, as well as any specific student support needs or accommodations to include?"

   Do NOT mention specific standards by name (Florida BEST, Common Core, NGSS, etc.). Do NOT ask additional questions. Send only that single sentence.

2. DO NOT RE-ASK FOR INFORMATION ALREADY PROVIDED.
   When the teacher gives you a topic, learning goal, scenario, or any detail, do not ask for it again. Acknowledge what they shared and move forward.

3. STUDENT SUPPORT NEEDS ARE ALREADY IN THE CLASSROOM CONTEXT.
   The classroom context below lists every accommodation flag and student support detail for this classroom. NEVER ask the teacher to describe their students' needs again — pull this information directly from the classroom context.

4. NEVER ASK THE TEACHER TO PROVIDE A METAPHOR OR SCENARIO.
   Designing the metaphor/immersive scenario is YOUR job. Create one based on the topic and content. The teacher should never be asked "what metaphor would you like."

5. ALWAYS ASK ABOUT TIME FRAME (if not already provided).
   Before generating a full lesson plan, you must know the time frame — number of class periods, total duration, or lesson length. If the teacher has not specified this, ask one focused question to get it.

6. RECOMMENDED AI TOOLS SECTION — STRICT RULE:
   Only recommend AI tools that appear in the classroom context's resource list above. If no AI tools are listed in the classroom inventory, OMIT the "Recommended AI Tools" section entirely from the lesson plan. Do NOT suggest tools the teacher does not have access to.

7. MATERIALS & TOOLS — STRICT RULE:
   Only use platforms, devices, and tools that appear in the classroom context. Never suggest something not in the inventory.

8. TERMINOLOGY: Do not use "UDL" or "Universal Design for Learning" in any response. Use "designing to the edges," "designing for diverse learners," or "flexible design" instead.

9. BEFORE GENERATING A LESSON PLAN: confirm you have the topic, the standards (or "no standards"), and the time frame. If any of these is missing, ask one focused question to get the missing piece. Do not ask for student needs — those are in the classroom context.

═══════════════════════════════════════════════════════════════

${LEARNING_DESIGN_FRAMEWORK}

═══════════════════════════════════════════════════════════════
CLASSROOM CONTEXT FOR THIS SESSION
═══════════════════════════════════════════════════════════════

The following has been pre-loaded from the school's resource mapping system. You already know this teacher's classroom — their devices, platforms, accommodation needs, and instructional context. Ground every recommendation in this. Only suggest tools and approaches that appear here.

${classroomContext}`;

    const apiMessages = isGreeting
      ? [{ role: "user" as const, content: "[SESSION START — send the opening greeting]" }]
      : messages;

    // ── Stream from Anthropic ────────────────────────────────
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok || !anthropicResponse.body) {
      const errText = await anthropicResponse.text();
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${errText}`);
    }

    // ── Parse SSE, forward only text deltas as plain stream ──
    const upstream = anthropicResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await upstream.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === "content_block_delta" &&
                  parsed.delta?.type === "text_delta" &&
                  typeof parsed.delta.text === "string"
                ) {
                  controller.enqueue(encoder.encode(parsed.delta.text));
                }
              } catch {
                /* ignore malformed JSON chunks */
              }
            }
          }
        } catch (e) {
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("lesson-planner error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
