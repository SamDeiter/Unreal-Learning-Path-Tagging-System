# Unreal Learning Path Tagging System

A system to **analyze user queries** about Unreal Engine, **tag them semantically**, and **generate personalized learning paths** for solving UE issues.

---

## 🎯 Project Goals

1. **Query Analysis** – Capture and normalize user questions about Unreal Engine
2. **Semantic Tagging** – Automatically categorize queries using a structured taxonomy
3. **Learning Path Generation** – Match tagged queries to curated learning resources

---

## 📁 Project Structure

```
├── tags/
│   ├── schema.json       # Tag data schema definition
│   └── taxonomy.json     # Predefined tag taxonomy
├── user_queries/
│   ├── schema.json       # User query schema
│   └── examples/         # Sample queries for testing
├── learning_paths/
│   ├── schema.json       # Learning path schema
│   └── templates/        # Path templates
└── README.md
```

---

## 🏷️ Tag Schema

Tags have the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the tag |
| `type` | enum | One of: `category`, `concept`, `skill_level`, `ue_feature`, `issue_type` |
| `relatedQueries` | array | IDs of user queries associated with this tag |
| `description` | string | Human-readable description |
| `parentTag` | string | Optional parent for hierarchical organization |

### Tag Types

- **category** – Broad UE5 domains (Blueprints, Materials, Animation)
- **concept** – Specific concepts (Event Graph, State Machines)
- **skill_level** – Difficulty levels (Beginner, Intermediate, Advanced)
- **ue_feature** – Specific UE features (Niagara, Lumen, Nanite)
- **issue_type** – Problem categories (Performance, Compile Error, Runtime)

---

## 🔄 Workflow

```
User Query → Tag Analysis → Tag Assignment → Learning Path Matching → Resource Delivery
```

1. User submits a query about an Unreal Engine issue
2. System analyzes query text and assigns relevant tags
3. Tags are matched against learning path requirements
4. Personalized learning path is generated

---

## 🚀 Future Roadmap

- [ ] Integration with UE5 LMS ecosystem
- [ ] AI-powered query analysis
- [ ] Dynamic learning path generation
- [ ] Progress tracking per user
- [ ] Query resolution feedback loop

---

## 📚 Related Projects

- [UE5QuestionGenerator](https://github.com/SamDeiter/UE5QuestionGenerator)
- [UE5LMSBlueprint](https://github.com/SamDeiter/UE5LMSBlueprint)
- [UE5LMSMaterials](https://github.com/SamDeiter/UE5LMSMaterials)

---

## License

MIT License
