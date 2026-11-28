#!/usr/bin/env python3
import sys
import json


def send(message):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    try:
        message = json.loads(line)
    except ValueError:
        continue
    if not isinstance(message, dict) or not isinstance(message.get("method"), str) or "id" not in message:
        continue
    response = {"jsonrpc": "2.0", "id": message["id"]}
    try:
        method = message["method"]
        params = message.get("params") or {}
        if method == "initialize":
            version = params.get("protocolVersion")
            response["result"] = {"protocolVersion": version if isinstance(version, str) else "2025-06-18", "capabilities": {"tools": {}}, "serverInfo": {"name": "__NAME__", "version": "1"}}
        elif method == "ping":
            response["result"] = {}
        elif method == "tools/list":
            response["result"] = {"tools": [{"name": "echo", "description": "Echo text", "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}}]}
        elif method == "tools/call":
            if params.get("name") != "echo":
                raise ValueError("Tool not found")
            args = params.get("arguments") or {}
            response["result"] = {"content": [{"type": "text", "text": str(args.get("text", ""))}], "isError": False}
        else:
            response["error"] = {"code": -32601, "message": "Method not found"}
    except Exception as error:
        response["error"] = {"code": -32603, "message": str(error)}
    send(response)
