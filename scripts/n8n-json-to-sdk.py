#!/usr/bin/env python3
"""
Converte JSON de workflow N8N em código TypeScript usando @n8n/workflow-sdk.

Suporta:
- AI agents com subnodes inline (model/memory/tools/outputParser)
- IF/Switch com branches corretas (.onTrue/.onFalse, .onCase)
- Múltiplos triggers
- Sticky notes, position, disabled, credentials, retry/continueOnFail/onError

Uso:
    python3 scripts/n8n-json-to-sdk.py path/to/workflow.json [extra_nodes.json] > workflow.ts

Se extra_nodes.json for fornecido, ele é mesclado depois — pode conter:
    {
      "nodes": [{...}],         # nós novos (mesmo formato N8N)
      "connections_patch": {     # patch nas connections
        "remove": [["sourceName", "main", branch_idx, "targetName"]],
        "add": [{"source": "...", "type": "main", "branch": 0, "target": "..."}]
      }
    }
"""
import json
import re
import sys
from pathlib import Path


def safe_var(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]", "_", name)
    if s and s[0].isdigit():
        s = "n_" + s
    return s or "node_" + str(abs(hash(name)) % 10000)


def js_literal(value, indent: int = 0) -> str:
    pad = "  " * indent
    pad_inner = "  " * (indent + 1)
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        if not value:
            return "[]"
        items = [js_literal(v, indent + 1) for v in value]
        joined = ",\n".join(f"{pad_inner}{it}" for it in items)
        return "[\n" + joined + "\n" + pad + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = []
        for k, v in value.items():
            key_str = k if k.isidentifier() else json.dumps(k)
            items.append(f"{pad_inner}{key_str}: {js_literal(v, indent + 1)}")
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    return json.dumps(value, ensure_ascii=False)


TRIGGER_TYPES = {
    "n8n-nodes-base.scheduleTrigger",
    "n8n-nodes-base.webhook",
    "n8n-nodes-base.manualTrigger",
    "n8n-nodes-base.telegramTrigger",
    "n8n-nodes-base.executeWorkflowTrigger",
    "n8n-nodes-base.formTrigger",
    "n8n-nodes-base.cron",
    "n8n-nodes-base.emailReadImap",
}

AI_AGENT_TYPES = {
    "@n8n/n8n-nodes-langchain.agent",
    "@n8n/n8n-nodes-langchain.chainLlm",
    "@n8n/n8n-nodes-langchain.chainSummarization",
}
AI_LANGMODEL_TYPES = {
    "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
    "@n8n/n8n-nodes-langchain.lmChatOpenAi",
    "@n8n/n8n-nodes-langchain.lmChatAnthropic",
    "@n8n/n8n-nodes-langchain.lmChatGroq",
    "@n8n/n8n-nodes-langchain.lmChatOllama",
    "@n8n/n8n-nodes-langchain.googleGemini",
}
AI_MEMORY_TYPES = {
    "@n8n/n8n-nodes-langchain.memoryPostgresChat",
    "@n8n/n8n-nodes-langchain.memoryBufferWindow",
    "@n8n/n8n-nodes-langchain.memoryRedisChat",
}
AI_TOOL_TYPES = {
    "@n8n/n8n-nodes-langchain.toolHttpRequest",
    "@n8n/n8n-nodes-langchain.toolThink",
    "@n8n/n8n-nodes-langchain.mcpClientTool",
    "@n8n/n8n-nodes-langchain.toolWorkflow",
    "@n8n/n8n-nodes-langchain.agentTool",
    "@n8n/n8n-nodes-langchain.toolCode",
    "@n8n/n8n-nodes-langchain.toolCalculator",
    "n8n-nodes-base.postgresTool",
    "n8n-nodes-base.googleDriveTool",
    "n8n-nodes-base.gmailTool",
    "n8n-nodes-base.googleTasksTool",
    "n8n-nodes-base.telegramTool",
}
AI_OUTPUT_PARSER_TYPES = {
    "@n8n/n8n-nodes-langchain.outputParserStructured",
    "@n8n/n8n-nodes-langchain.outputParserItemList",
}


def sdk_func_for(node_type: str) -> str:
    if node_type in TRIGGER_TYPES:
        return "trigger"
    if node_type == "n8n-nodes-base.if":
        return "ifElse"
    if node_type == "n8n-nodes-base.switch":
        return "switchCase"
    if node_type == "n8n-nodes-base.merge":
        return "merge"
    if node_type == "n8n-nodes-base.splitInBatches":
        return "splitInBatches"
    if node_type in AI_LANGMODEL_TYPES:
        return "languageModel"
    if node_type in AI_MEMORY_TYPES:
        return "memory"
    if node_type in AI_TOOL_TYPES:
        return "tool"
    if node_type in AI_OUTPUT_PARSER_TYPES:
        return "outputParser"
    return "node"


def is_subnode(node_type: str) -> bool:
    return (
        node_type in AI_LANGMODEL_TYPES
        or node_type in AI_MEMORY_TYPES
        or node_type in AI_TOOL_TYPES
        or node_type in AI_OUTPUT_PARSER_TYPES
    )


def gen_node_decl(node: dict, agent_subnodes: dict | None = None) -> str:
    var = safe_var(node["name"])
    func = sdk_func_for(node["type"])
    config: dict = {
        "name": node["name"],
    }
    if node.get("parameters"):
        config["parameters"] = node["parameters"]

    # Subnodes (model/memory/tools) inline na config do agent
    if agent_subnodes:
        sn: dict = {}
        if agent_subnodes.get("model"):
            sn["model"] = agent_subnodes["model"]
        if agent_subnodes.get("memory"):
            sn["memory"] = agent_subnodes["memory"]
        if agent_subnodes.get("outputParser"):
            sn["outputParser"] = agent_subnodes["outputParser"]
        if agent_subnodes.get("tools"):
            sn["tools"] = agent_subnodes["tools"]
        if sn:
            config["__subnodes_raw__"] = sn

    if "position" in node:
        config["position"] = node["position"]
    if node.get("disabled"):
        config["disabled"] = node["disabled"]
    if node.get("webhookId"):
        config["webhookId"] = node["webhookId"]
    if node.get("notes"):
        config["notes"] = node["notes"]
    if node.get("notesInFlow"):
        config["notesInFlow"] = node["notesInFlow"]
    if node.get("retryOnFail"):
        config["retryOnFail"] = node["retryOnFail"]
    if node.get("continueOnFail") is not None:
        config["continueOnFail"] = node["continueOnFail"]
    if node.get("onError"):
        config["onError"] = node["onError"]
    if node.get("credentials"):
        config["credentials"] = node["credentials"]
    if node.get("alwaysOutputData") is not None:
        config["alwaysOutputData"] = node["alwaysOutputData"]
    if node.get("executeOnce") is not None:
        config["executeOnce"] = node["executeOnce"]

    # Render config
    config_str = render_config(config)
    type_lit = json.dumps(node["type"])
    version = node.get("typeVersion", 1)

    return f"const {var} = {func}({{\n  type: {type_lit},\n  version: {version},\n  config: {config_str}\n}});\n"


def render_config(config: dict) -> str:
    """Render config dict, expandindo __subnodes_raw__ pra referências de var."""
    pad = "  "
    lines = ["{"]
    items = []
    for k, v in config.items():
        if k == "__subnodes_raw__":
            sn_lines = ["    subnodes: {"]
            for sk, sv in v.items():
                if isinstance(sv, list):
                    refs = ", ".join(sv)
                    sn_lines.append(f"      {sk}: [{refs}],")
                else:
                    sn_lines.append(f"      {sk}: {sv},")
            sn_lines.append("    }")
            items.append("\n".join(sn_lines))
        else:
            key_str = k if k.isidentifier() else json.dumps(k)
            items.append(f"    {key_str}: {js_literal(v, indent=2)}")
    lines.append(",\n".join(items))
    lines.append("  }")
    return "\n".join(lines)


def detect_subnodes(connections: dict, name_to_var: dict) -> dict[str, dict]:
    """
    Pra cada agent, descobre os subnodes (model/memory/tools) conectados.
    Retorna dict[agent_name] = {model: var, memory: var, tools: [vars]}
    """
    agents: dict[str, dict] = {}
    for source_name, conn_dict in connections.items():
        if source_name not in name_to_var:
            continue
        source_var = name_to_var[source_name]
        for conn_type, branches in conn_dict.items():
            if conn_type not in ("ai_languageModel", "ai_memory", "ai_tool", "ai_outputParser"):
                continue
            # branches é list[list[{node, type, index}]]
            for targets in branches:
                for t in targets:
                    target_name = t.get("node")
                    if not target_name:
                        continue
                    agents.setdefault(target_name, {})
                    if conn_type == "ai_languageModel":
                        agents[target_name]["model"] = source_var
                    elif conn_type == "ai_memory":
                        agents[target_name]["memory"] = source_var
                    elif conn_type == "ai_outputParser":
                        agents[target_name]["outputParser"] = source_var
                    elif conn_type == "ai_tool":
                        agents[target_name].setdefault("tools", []).append(source_var)
    return agents


def gen_main_chains(connections: dict, name_to_var: dict, node_types: dict) -> list[str]:
    """Gera as chains .add().to() das connections main entre nós."""
    chains: list[str] = []
    # Agrupa connections por source pra detectar fan-out (mesmo source, múltiplas branches)
    for source_name, conn_dict in connections.items():
        if source_name not in name_to_var:
            continue
        source_var = name_to_var[source_name]
        main = conn_dict.get("main")
        if not main:
            continue
        source_type = node_types.get(source_name, "")
        is_if = source_type == "n8n-nodes-base.if"
        is_switch = source_type == "n8n-nodes-base.switch"

        # main é list[list[{node, type, index}]]
        for branch_idx, targets in enumerate(main):
            if not targets:
                continue
            for t in targets:
                target_name = t.get("node")
                if not target_name or target_name not in name_to_var:
                    continue
                target_var = name_to_var[target_name]
                if is_if:
                    method = ".onTrue" if branch_idx == 0 else ".onFalse"
                    chains.append(f"  .add({source_var}){method}({target_var})")
                elif is_switch:
                    chains.append(f"  .add({source_var}).onCase({branch_idx}, {target_var})")
                else:
                    if branch_idx == 0:
                        chains.append(f"  .add({source_var}).to({target_var})")
                    else:
                        # Saída secundária genérica — usar .branch(idx).to() (fallback)
                        chains.append(f"  .add({source_var}).output({branch_idx}).to({target_var})")
    return chains


def merge_extras(wf: dict, extras: dict) -> dict:
    """Aplica patches de nodes/connections."""
    nodes = list(wf.get("nodes", []))
    connections = dict(wf.get("connections") or wf.get("activeVersion", {}).get("connections", {}))

    # Adiciona nodes novos
    for new_node in extras.get("nodes", []):
        # Substitui se já existir pelo nome (idempotente)
        nodes = [n for n in nodes if n.get("name") != new_node.get("name")]
        nodes.append(new_node)

    # Patch connections
    patch = extras.get("connections_patch", {})

    # Remove
    for src, conn_type, branch_idx, target in patch.get("remove", []):
        cd = connections.get(src, {})
        ml = cd.get(conn_type)
        if not ml or branch_idx >= len(ml):
            continue
        ml[branch_idx] = [t for t in ml[branch_idx] if t.get("node") != target]
        cd[conn_type] = ml
        connections[src] = cd

    # Add
    for c in patch.get("add", []):
        src = c["source"]
        ctype = c.get("type", "main")
        branch = c.get("branch", 0)
        target = c["target"]
        target_idx = c.get("target_index", 0)
        target_type = c.get("target_type", "main")

        cd = connections.get(src, {})
        ml = cd.get(ctype, [])
        # Garante que branch existe
        while len(ml) <= branch:
            ml.append([])
        ml[branch].append({"node": target, "type": target_type, "index": target_idx})
        cd[ctype] = ml
        connections[src] = cd

    # Substitui no workflow
    wf["nodes"] = nodes
    wf["connections"] = connections
    return wf


def gen_workflow(data: dict, extras: dict | None = None) -> str:
    wf = data.get("workflow") or data
    if extras:
        wf = merge_extras(wf, extras)

    name = wf.get("name", "Unnamed")
    wid = wf.get("id", "unknown")
    nodes = wf.get("nodes", [])
    connections = wf.get("connections") or wf.get("activeVersion", {}).get("connections", {})

    name_to_var = {n["name"]: safe_var(n["name"]) for n in nodes}
    node_types = {n["name"]: n["type"] for n in nodes}

    # Detecta subnodes pra cada agent
    agent_subnodes = detect_subnodes(connections, name_to_var)

    # Sets pra dedup
    triggers = [n for n in nodes if n["type"] in TRIGGER_TYPES]
    non_triggers = [n for n in nodes if n["type"] not in TRIGGER_TYPES]

    # Header
    out = []
    out.append(
        "// Generated by scripts/n8n-json-to-sdk.py\n"
        "// DO NOT edit manually unless you know what you're doing.\n"
        "import {\n"
        "  workflow, node, trigger, ifElse, switchCase, merge, splitInBatches,\n"
        "  nextBatch, languageModel, memory, tool, outputParser\n"
        "} from '@n8n/workflow-sdk';\n"
    )

    # Subnodes primeiro (model/memory/tools/parser) — eles precisam estar declarados antes do agent
    subnode_nodes = [n for n in non_triggers if is_subnode(n["type"])]
    other_nodes = [n for n in non_triggers if not is_subnode(n["type"])]

    for n in subnode_nodes:
        out.append(gen_node_decl(n))

    # Agentes e demais nós (com subnodes inline se aplicável)
    for n in other_nodes:
        sn = agent_subnodes.get(n["name"]) if n["type"] in AI_AGENT_TYPES else None
        out.append(gen_node_decl(n, agent_subnodes=sn))

    # Triggers
    for n in triggers:
        out.append(gen_node_decl(n))

    # Workflow chain
    out.append(f"\nexport default workflow({json.dumps(wid)}, {json.dumps(name)})\n")

    chains = gen_main_chains(connections, name_to_var, node_types)
    out.extend(chains)
    out.append(";\n")

    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("usage: n8n-json-to-sdk.py <workflow.json> [extras.json]\n")
        sys.exit(2)
    wf_path = Path(sys.argv[1])
    data = json.loads(wf_path.read_text())

    extras = None
    if len(sys.argv) >= 3:
        extras_path = Path(sys.argv[2])
        extras = json.loads(extras_path.read_text())

    print(gen_workflow(data, extras))


if __name__ == "__main__":
    main()
