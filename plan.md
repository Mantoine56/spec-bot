Before you dive into code, here’s the big picture: build a thin, provider-agnostic “Spec-Bot” that orchestrates three LangGraph nodes (Requirements → Design → Tasks), each gated by a human-in-the-loop checkpoint. The bot wraps an interchangeable LLM layer—so you can point it at Ollama for offline work or OpenAI / Azure OpenAI / any future API without touching the workflow logic. All documents are rendered from strict Jinja2 templates into a .specbot/specs/{feature}/ folder, persisted in Git, and surfaced via a simple CLI (later, you can bolt on a Streamlit front-end). Below is a concrete implementation plan that matches your constraints, tooling preferences (Azure, local VMs, Git-centric dev), and the approval rules you specified.

⸻

1. Choose & wire up the orchestration stack

Layer	Recommendation	Rationale
Workflow graph	LangGraph (Python)	Native human-in-loop nodes for explicit “approve / revise” gates  ￼ and first-class persistence & debugging  ￼.
LLM adapter	Custom LLMClient interface with plug-ins for • ChatOllama (local)  ￼  ￼ • OpenAI / Assistants/Responses API for cloud  ￼ ￼ • AzureOpenAI	Keeps you vendor-agnostic; swap models with a flag.
Research tool	Optional Tavily or Bing wrapper for online runs; skip on closed networks.	
Templates	Jinja2 files for requirements.md, design.md, tasks.md enforce exact sections.	
CLI / UI	Click-powered CLI today; Streamlit panel tomorrow.	
Storage	Local file system → Git repo; CI runs in GitHub Actions or Azure DevOps.	


⸻

2. Repository bootstrap

mkdir spec-bot && cd spec-bot
python -m venv .venv && source .venv/bin/activate
pip install langchain langgraph langchain_community pydantic jinja2 rich click
# optional providers
pip install openai azure-ai-openai tavily-python

Create this tree:

spec-bot/
├─ spec_bot/
│  ├─ __init__.py
│  ├─ llm_client.py      # adapter pattern
│  ├─ templates/
│  │   ├─ requirements.md.j2
│  │   ├─ design.md.j2
│  │   └─ tasks.md.j2
│  ├─ graph.py           # LangGraph nodes + edges
│  └─ cli.py             # `spec create "idea"` etc.
└─ tests/


⸻

3. Build the LangGraph workflow

3.1. Shared state object

class SpecState(BaseModel):
    feature_name: str
    feature_dir: Path
    requirements_approved: bool = False
    design_approved: bool = False

3.2. Nodes

Node	Function
generate_requirements	Render template using the rough idea + LLM JSON output.
await_requirements_approval	Pause; CLI prints “Do the requirements look good?”; resume on yes.
generate_design	Reads requirements.md; injects research snippets; writes design.md.
await_design_approval	Same gate with prompt “Does the design look good?”
generate_tasks	Reads both docs; creates numbered checkbox plan; writes tasks.md.
await_tasks_approval	Final gate; if approved, workflow exits.

Human-gate implementation: langgraph.graph.add_observer(human_gate) where human_gate reads stdin and sets state boolean  ￼.

⸻

4. Template prompts

4.1. Requirements template excerpt

# Requirements Document

## Introduction
{{ intro }}

## Requirements
{% for req in requirements %}
### Requirement {{ loop.index }}
**User Story:** {{ req.user_story }}

#### Acceptance Criteria
{% for ac in req.ac %}
{{ loop.index }}. {{ ac }}
{% endfor %}
{% endfor %}

Prompt the LLM with:

“Return a JSON array of {user_story, ac[]} objects in EARS format. Edge cases, UX, tech constraints must be covered.”

Parse JSON → Jinja2 → file.

⸻

5. CLI commands

@click.group()
def cli(): ...

@cli.command()
@click.argument("idea")
def create(idea):
    """Create a new spec from ROUGH_FEATURE_IDEA."""
    run_workflow(idea)

Each approval gate simply waits for input()—handy when you run via SSH on an offline VM.

⸻

6. Testing & CI
	1.	Unit tests: kebab-case converter, JSON-to-MD renderer.
	2.	Snapshot tests with pytest-approvaltests on sample ideas.
	3.	GitHub Actions / Azure DevOps pipeline to run pytest, ruff, and type checks  ￼.

⸻

7. Optional extensions

Need	Option
Visual flow editing	Flowise drag-and-drop UI  ￼
Multi-agent brainstorming	CrewAI or AutoGen crew before Phase 1  ￼ ￼
Data-centric RAG	LlamaIndex workflows for design research  ￼
Azure-native pipeline	Re-implement in Promptflow when you want full MLOps with lineage  ￼


⸻

8. Roll-out roadmap
	1.	Week 1 – Repo scaffolding, templates, kebab-case utility, CLI skeleton.
	2.	Week 2 – Implement generate_requirements, approval gate, and tests.
	3.	Week 3 – Add design node with research integration; Mermaid diagrams via LLM (@mermaid fenced block).
	4.	Week 4 – Implement tasks generator; polish CLI UX.
	5.	Week 5 – Package (pip install -e .), write README; deploy to offline VM (point LLMClient to Ollama).
	6.	Week 6 – Optional Streamlit UI; integrate with your Azure DevOps repos for spec reviews.

⸻


#####

Outcome expected:

Overview of the Spec Creation Process
The spec creation workflow is a systematic approach to transforming a rough feature idea into a comprehensive implementation plan. It follows three sequential phases:

Requirements Gathering → requirements.md
Design Document Creation → design.md
Task List Generation → tasks.md
Each phase has strict constraints and requires explicit user approval before proceeding to the next phase.

Phase 1: Requirements Gathering (requirements.md)
Initial Setup
When a user provides a rough feature idea, I first:

Generate a short feature name in kebab-case format (e.g., "user-authentication", "product-image-fix")
Create the directory structure: .specbot/specs/{feature_name}/
Create the requirements.md file if it doesn't exist
Document Structure
I MUST format the requirements document with this exact structure:

# Requirements Document

## Introduction
[Clear summary of the feature and its purpose]

## Requirements

### Requirement 1
**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria
1. WHEN [event] THEN [system] SHALL [response]
2. IF [precondition] THEN [system] SHALL [response]

### Requirement 2
**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria
1. WHEN [event] THEN [system] SHALL [response]
2. WHEN [event] AND [condition] THEN [system] SHALL [response]
Key Constraints for Requirements Phase
MUST DO:

Generate an initial version WITHOUT asking sequential questions first
Use EARS format (Easy Approach to Requirements Syntax) for acceptance criteria
Include hierarchical numbered requirements with user stories
Consider edge cases, user experience, technical constraints, and success criteria
Ask for explicit approval using the userInput tool with reason 'spec-requirements-review'
Make modifications if user requests changes
Continue feedback-revision cycle until explicit approval
MUST NOT DO:

Proceed to design without clear approval ("yes", "approved", "looks good")
Focus on code exploration in this phase
Skip the user approval step
Example Requirements Content
For a product image management feature, I would create requirements like:

### Requirement 1
**User Story:** As a store administrator, I want to upload and manage product images, so that customers can see accurate visual representations of products.

#### Acceptance Criteria
1. WHEN an administrator uploads an image THEN the system SHALL validate the file format (JPEG, PNG, WebP)
2. WHEN an image exceeds size limits THEN the system SHALL reject the upload and display an error message
3. WHEN an image is successfully uploaded THEN the system SHALL generate thumbnails automatically
Phase 2: Design Document Creation (design.md)
Prerequisites
Requirements document must exist and be approved
I must read the requirements document to base the design on it
Research Integration
Before creating the design, I:

Identify areas needing research based on requirements
Conduct research and build context in the conversation
Summarize key findings that inform the design
Cite sources and include relevant links
Use research findings directly in the design process
Document Structure
The design document MUST include these sections:

# Design Document

## Overview
[High-level description of the solution]

## Architecture
[System architecture and component relationships]

## Components and Interfaces
[Detailed component specifications]

## Data Models
[Database schemas, data structures]

## Error Handling
[Error scenarios and handling strategies]

## Testing Strategy
[Approach to testing the feature]
Key Constraints for Design Phase
MUST DO:

Create comprehensive design based on approved requirements
Include all required sections (Overview, Architecture, Components, Data Models, Error Handling, Testing Strategy)
Incorporate research findings directly into design decisions
Include diagrams or visual representations when appropriate (Mermaid for diagrams)
Highlight design decisions and their rationales
Ask for explicit approval using userInput tool with reason 'spec-design-review'
Address all feature requirements from the requirements document
MUST NOT DO:

Create separate research files (research stays in conversation context)
Proceed to implementation plan without explicit approval
Skip the comprehensive design sections
Example Design Content
For the same product image feature:

## Architecture
The image management system will follow a layered architecture:
- **Presentation Layer**: Vue.js components for upload interface
- **API Layer**: Express.js endpoints for image operations
- **Service Layer**: Image processing and validation services
- **Storage Layer**: AWS S3 for image storage, MySQL for metadata

## Data Models
```sql
CREATE TABLE product_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  alt_text VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

## Phase 3: Task List Generation (`tasks.md`)

### Prerequisites
- Design document must exist and be approved
- I must read both requirements and design documents

### Task Generation Instructions
I follow these specific instructions when creating the implementation plan:

> Convert the feature design into a series of prompts for a code-generation LLM that will implement each step in a test-driven manner. Prioritize best practices, incremental progress, and early testing, ensuring no big jumps in complexity at any stage. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

### Task Format Requirements
Tasks MUST be formatted as:
- Numbered checkbox list with maximum two levels of hierarchy
- Top-level items only when needed (like epics)
- Sub-tasks numbered with decimal notation (1.1, 1.2, 2.1)
- Each item must be a checkbox
- Simple structure preferred

### Task Content Requirements
Each task MUST include:
- Clear objective involving writing, modifying, or testing code
- Additional information as sub-bullets
- Specific references to requirements (granular sub-requirements, not just user stories)
- Actionable by a coding agent
- Builds incrementally on previous steps

### Key Constraints for Tasks Phase

**MUST DO:**
- Create discrete, manageable coding steps
- Reference specific requirements from requirements document
- Ensure each step builds incrementally
- Prioritize test-driven development
- Cover all aspects of design that can be implemented through code
- Focus ONLY on coding tasks (writing, modifying, testing code)
- Ask for explicit approval using `userInput` tool with reason `'spec-tasks-review'`

**MUST NOT DO:**
- Include non-coding tasks (user testing, deployment, performance metrics gathering)
- Include excessive implementation details already in design
- Proceed without explicit approval
- Include tasks that can't be executed by a coding agent

### Explicitly Excluded Task Types
- User acceptance testing or feedback gathering
- Deployment to production/staging
- Performance metrics gathering or analysis
- Running applications for end-to-end testing (automated tests are OK)
- User training or documentation creation
- Business process changes
- Marketing or communication activities

### Example Task Content
```markdown
# Implementation Plan

- [ ] 1. Set up image upload infrastructure
  - Create multer configuration for file uploads
  - Set up AWS S3 connection utilities
  - Write unit tests for upload configuration
  - _Requirements: 1.1, 1.2_

- [ ] 2. Implement image validation service
- [ ] 2.1 Create image format validation
  - Write validation functions for JPEG, PNG, WebP formats
  - Implement file size validation
  - Create unit tests for validation logic
  - _Requirements: 1.1_

- [ ] 2.2 Add image processing utilities
  - Implement thumbnail generation using Sharp
  - Create image optimization functions
  - Write tests for image processing
  - _Requirements: 1.3_
User Approval Process
Critical Approval Requirements
After completing each document, I MUST:

Use the userInput tool with the exact reason strings:

Requirements: 'spec-requirements-review'
Design: 'spec-design-review'
Tasks: 'spec-tasks-review'
Ask the exact questions:

Requirements: "Do the requirements look good? If so, we can move on to the design."
Design: "Does the design look good? If so, we can move on to the implementation plan."
Tasks: "Do the tasks look good?"
Wait for explicit approval like "yes", "approved", "looks good"

Continue feedback-revision cycle until approval is received

Make modifications if user requests changes

Never proceed to the next phase without explicit approval

Workflow Completion
The workflow is ONLY for creating design and planning artifacts. I MUST:

NOT attempt to implement the feature as part of this workflow
Clearly communicate that the workflow is complete once artifacts are created
Inform the user they can execute tasks by opening tasks.md and clicking "Start task"
Error Handling and Troubleshooting
Requirements Clarification Stalls
Suggest moving to different requirement aspects
Provide examples or options for decisions
Summarize established points and identify gaps
May suggest research to inform requirements
Research Limitations
Document missing information
Suggest alternative approaches
Ask user for additional context
Continue with available information rather than blocking
Design Complexity
Break down into smaller components
Focus on core functionality first
Suggest phased implementation approach
Return to requirements for feature prioritization
This detailed process ensures that every spec follows a consistent, thorough approach that transforms rough ideas into actionable implementation plans while maintaining quality and user involvement throughout the process.
