---
brand: Notion
tagline: "All-in-one workspace. Block-based editor, databases, wikis, and docs."
category: Productivity
website: https://notion.so
---

# Notion — Information Architecture

## Overview

Notion is a block-based workspace that unifies notes, databases, wikis, and project management into a single tool. The mental model is **everything is a block** — text, images, tables, databases, embeds, and even entire pages are interchangeable blocks that can be nested, rearranged, and transformed. Pages live in a freeform hierarchy, and any page can become a database with structured properties and multiple views (table, board, gallery, calendar, timeline).

## Site Map

```
├── Home (Teamspace Landing)
│   ├── Recently Visited
│   ├── Favorites (pinned pages)
│   ├── All Teamspaces Overview
│   └── Quick Search (⌘K)
├── Sidebar Navigation
│   ├── Search
│   ├── Notion AI (Ask AI)
│   ├── Home
│   ├── Inbox (notifications, mentions)
│   ├── Teamspaces
│   │   ├── Teamspace A
│   │   │   ├── Wiki pages
│   │   │   ├── Project databases
│   │   │   └── Meeting notes
│   │   └── Teamspace B
│   ├── Private Pages
│   │   ├── Personal notes
│   │   └── Drafts
│   ├── Shared Pages
│   ├── Favorites (starred pages)
│   └── Trash
├── Page View
│   ├── Page Header
│   │   ├── Icon (emoji or custom)
│   │   ├── Cover Image
│   │   ├── Title
│   │   └── Properties (if database item)
│   ├── Content Area (block canvas)
│   │   ├── Text Blocks (paragraph, heading 1/2/3)
│   │   ├── List Blocks (bulleted, numbered, to-do, toggle)
│   │   ├── Media Blocks (image, video, file, bookmark)
│   │   ├── Advanced Blocks
│   │   │   ├── Table (simple)
│   │   │   ├── Database (inline — full, linked)
│   │   │   ├── Callout
│   │   │   ├── Quote
│   │   │   ├── Divider
│   │   │   ├── Code (syntax-highlighted)
│   │   │   ├── Math (KaTeX)
│   │   │   ├── Table of Contents
│   │   │   ├── Breadcrumb
│   │   │   ├── Column Layout (2–5 columns)
│   │   │   ├── Synced Block (live reference across pages)
│   │   │   └── Embed (Figma, Loom, Maps, 40+ integrations)
│   │   └── Template Button (repeatable block patterns)
│   ├── Comments (inline + page-level)
│   ├── Backlinks (pages referencing this page)
│   └── Page History (version snapshots)
├── Database
│   ├── Views
│   │   ├── Table View
│   │   ├── Board View (Kanban by select property)
│   │   ├── Gallery View (card layout with cover)
│   │   ├── List View (compact)
│   │   ├── Calendar View (by date property)
│   │   └── Timeline View (Gantt-style by date range)
│   ├── Properties
│   │   ├── Text, Number, Select, Multi-select
│   │   ├── Date, Person, Files, Checkbox, URL, Email, Phone
│   │   ├── Formula, Relation, Rollup
│   │   ├── Created time, Last edited time, Created by, Last edited by
│   │   └── Unique ID, Status (new)
│   ├── Filters, Sorts, Groups (per view)
│   ├── Sub-items (nested database items)
│   └── Database Templates (per-view defaults)
├── Templates
│   ├── Template Gallery (Notion-curated)
│   ├── Community Templates
│   └── My Templates (duplicated pages)
├── Notion AI
│   ├── Ask AI (Q&A across workspace)
│   ├── AI Writer (draft, summarize, translate, fix grammar)
│   ├── AI Autofill (database property AI fill)
│   └── AI Blocks (generated summaries, action items)
├── Integrations & Connections
│   ├── Slack, GitHub, Jira, Google Drive, Figma...
│   ├── Notion API (developer integrations)
│   └── Import (Evernote, Confluence, Markdown, CSV, HTML)
├── Settings & Members
│   ├── Workspace Settings (name, icon, domain)
│   ├── Members & Groups
│   ├── Teamspaces
│   ├── Identity & Provisioning (SAML SSO, SCIM)
│   ├── Connections (integrations)
│   ├── Notifications
│   ├── Appearance (light/dark, font: default/serif/mono)
│   ├── Language & Region
│   └── Plans & Billing
└── Publish / Share
    ├── Share to Web (public page)
    ├── Share with People (invite by email)
    ├── Guest Access
    └── Notion Sites (custom domain publishing)
```

## Navigation Model

| Layer | Pattern | Behavior |
|-------|---------|----------|
| **Left Sidebar** | Collapsible, resizable (default 240px) | Teamspace tree, favorites, private pages, search, inbox, trash |
| **Breadcrumb** | Top of page area | Teamspace > Parent Page > Current Page |
| **Block Menu** | `+` button or `/` slash command | Insert any block type (40+ options) |
| **Slash Command** | Type `/` anywhere in content | Quick insert: heading, database, image, embed, AI, toggle... |
| **Link Autocomplete** | Type `@` or `[[` | Mention page, person, date; link to existing page |
| **Command Palette** | ⌘K / Ctrl+K | Universal search + navigation + quick actions |
| **Drag & Drop** | Block handles (⋮⋮) and sidebar items | Rearrange blocks, move pages between sections |
| **Turn Into** | Select block → Transform | Change any block type to another (text ↔ heading ↔ toggle ↔ callout) |
| **Page Peek** | Hold ⌘ + click link | Preview linked page in side panel without navigating away |

### Sidebar Structure
```
🔍 Search
🤖 Notion AI
🏠 Home
📥 Inbox
─────────────
⭐ Favorites
  Design System ▾
  Q1 Roadmap
─────────────
🏢 Teamspace: Engineering
  📄 Wiki ▾
    Architecture Docs
    Onboarding Guide
  📊 Sprint Board (database)
  📝 Meeting Notes ▾
─────────────
🏢 Teamspace: Marketing
  Campaign Tracker
  Content Calendar
─────────────
🔒 Private
  Personal Journal
  1:1 Notes ▾
─────────────
👥 Shared
  Cross-team Projects
─────────────
🗑 Trash
```

## Content Model

| Entity | Key Attributes | Relationships |
|--------|---------------|---------------|
| Workspace | name, icon, domain, plan, settings | has many Teamspaces, Members |
| Teamspace | name, icon, visibility (open/closed/private), default permissions | has many Pages |
| Page | title, icon, cover, parent_id, created_at, updated_at, created_by, full_width | has many Blocks, child Pages, Comments |
| Block | id, type, content, properties{}, children[], parent_id | belongs to Page; can nest child Blocks |
| Database | title, schema (properties[]), views[], is_inline | special Page type; items are child Pages with property values |
| Property | name, type, options{} (colors, formulas, relations) | belongs to Database schema |
| View | name, type, filters[], sorts[], groups[], visible_properties[] | belongs to Database |
| Synced Block | source_block_id, synced_copies[] | references across pages; edits propagate |
| Comment | body, author, inline_position (block + offset), resolved | belongs to Page or inline on Block |
| Template | content (page snapshot), target_database | belongs to Database or Template Gallery |
| Connection | type (Slack/GitHub/etc.), config{} | belongs to Workspace |

### Block Type Taxonomy
```
Text: paragraph | heading_1 | heading_2 | heading_3
Lists: bulleted_list | numbered_list | to_do | toggle
Media: image | video | audio | file | bookmark | embed
Data: table | database_inline | database_full_page | database_linked
Layout: column_list | divider | table_of_contents | breadcrumb
Annotation: callout | quote | code | math (KaTeX)
Interactive: template_button | synced_block | link_to_page
AI: ai_summary | ai_action_items | ai_custom_block
```

### Database Property Types
```
Basic: title | text | number | select | multi_select | status | checkbox
Date/Time: date | created_time | last_edited_time
People: person | created_by | last_edited_by
Media: files_and_media | url | email | phone
Computed: formula | relation | rollup | unique_id
```

## User Flows



### Quick Capture
```
⌘K → Type page title → Enter → Start writing → Drag to organize later
— or —
⌘N → New blank page → Write → Move to Teamspace
```

### Build a Wiki
```
Teamspace → [+ New Page] → Title "Engineering Wiki" → Add sub-pages (Architecture, Onboarding, Runbooks) → Toggle blocks for collapsible sections → Share with team
```

### Database Project Tracker
```
New Page → /database full page → Define properties (Status, Assignee, Priority, Sprint, Due Date) → Add items → Create Board View (group by Status) → Create Calendar View (by Due Date) → Filter views per team
```

### Knowledge Linking
```
Write note → Type [[ → Search and select page to link → Backlink auto-appears on target page → Build knowledge graph across workspace
```

### Notion AI Research
```
⌘J → "Summarize all Q1 meeting notes" → AI searches workspace → Returns synthesized answer with source page links
```

### Template Reuse
```
Database → New Template → Design layout (e.g., "Weekly Standup") → Team members click [+ New] → Select template → Pre-filled page created
```

## URL / Route Structure

```
/                                    → Home (recently visited)
/:workspaceSlug                      → Workspace root
/:workspaceSlug/:pageId              → Page view (UUID-based, slug suffix for readability)
/:workspaceSlug/:pageId?v=:viewId    → Database with specific view active
/:workspaceSlug/:pageId?p=:subpageId → Page peek (side panel preview)
/search                              → Search results
/trash                               → Trash
/settings                            → Workspace settings
/settings/members                    → Members
/settings/teamspaces                 → Teamspaces config
/settings/connections                → Integrations
/settings/billing                    → Plans & billing
/templates                           → Official template gallery
/site/:domain                        → Notion Sites (published)
/:workspaceSlug/:pageId (published)  → Public read-only page
/api/v1/...                          → Notion API endpoints
```

## Search & Filter

| Context | Search Scope | Filters | Sort |
|---------|-------------|---------|------|
| Quick Search (⌘K) | Page titles, block content, database items | Created By, Date Range, Teamspace, In (specific page) | Best Match, Last Edited, Created |
| Database View | Property values within current database | Any property (type-aware: select, date range, person, checkbox, formula) | Any property, ascending/descending |
| In-page (⌘F) | Current page text content | — | Position in page |
| Notion AI (⌘J) | Semantic search across entire workspace | — | Relevance |

### Database Filter Operators
```
Text: is / is not / contains / does not contain / starts with / ends with / is empty
Number: = / ≠ / > / < / ≥ / ≤
Select: is / is not / is any of / is none of
Date: is / before / after / on or before / on or after / is within (past week, next month...)
Person: is / is not / contains / does not contain
Checkbox: is checked / is not checked
Relation: contains / does not contain / is empty / is not empty
Formula: depends on output type (text/number/date/checkbox)
```

## Responsive Behavior

| Breakpoint | Sidebar | Content | Editor |
|------------|---------|---------|--------|
| Desktop (≥1280px) | Expanded sidebar (240px, resizable) | Centered (max 900px default, full-width toggle) | Full block controls, `⋮⋮` handles, `/` menu |
| Tablet (768–1279px) | Overlay sidebar (hamburger toggle) | Full-width centered | Simplified block menu |
| Mobile (<768px) | Drawer (swipe from left) | Full-width | Touch-optimized, bottom toolbar above keyboard |

### Mobile-Specific Features
- Floating format bar (bold, italic, list, heading, AI) above keyboard
- Swipe from left edge for sidebar
- Share sheet for web clip capture
- Offline mode with background sync queue
- Widget: favorite pages and recent edits on home screen
- Simplified `/` menu (most-used block types first)

## Access Control

| Role | View | Edit | Comment | Share | Admin |
|------|------|------|---------|-------|-------|
| Guest (free) | Invited pages only | If page allows | If page allows | — | — |
| Member | All Teamspace pages (based on Teamspace settings) | Teamspace content | ✅ | Own pages | — |
| Teamspace Owner | Teamspace pages | ✅ | ✅ | ✅ | Teamspace members, settings |
| Workspace Admin | ✅ | ✅ | ✅ | ✅ | Settings, members, billing |
| Workspace Owner | ✅ | ✅ | ✅ | ✅ | Full control, transfer ownership |

### Page-Level Permissions
- **Full Access**: Edit content + manage sharing
- **Can Edit**: Edit content, cannot change sharing
- **Can Edit Content**: Edit blocks but not properties/views (database-specific)
- **Can Comment**: Read + add comments
- **Can View**: Read-only
- **No Access**: Explicitly hidden from specific members

### Teamspace Visibility
- **Open**: Any workspace member can see and join
- **Closed**: Visible in directory but join requires approval
- **Private**: Invisible unless explicitly invited
