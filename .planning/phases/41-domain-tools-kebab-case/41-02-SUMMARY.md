---
wave: 1
requirements: []
files_modified:
  - be/app/domain/tool_registry.py
  - be/app/api/llm.py
  - be/app/services/coaching_service.py
  - be/tests/domain/test_parallel_tools.py
---

# Summary 41-02: Tool Registry and Parallel Tool Execution

## Goal Achieved

Implemented a tool registry system that lists all available tools to the LLM and enables parallel/batch tool execution rather than forcing the LLM to loop over sequential tool calls. This improves efficiency, allows for more natural reasoning, and provides a better developer experience.

## Implementation Details

1. **Central Tool Registry**
   - Created a tool registry that collects tools across all domains
   - Registry provides domain-specific and cross-domain tool access
   - Tools are indexed by name for quick lookup
   - Each tool maintains domain context for proper execution

2. **Parallel Tool Execution**
   - Implemented a `ParallelToolHandler` that executes tools concurrently using `asyncio`
   - Supports both synchronous and asynchronous tool implementations
   - Tools can be executed in batches in a single request
   - Results are collected and returned in the same order as the tool calls

3. **LLM Client Integration**
   - Updated the LLM client to support tool execution
   - LLM receives the complete list of available tools in a single context
   - Client processes tool calls from the LLM response and executes them in parallel
   - Results are attached to the response for subsequent LLM reasoning

4. **Coaching Service Updates**
   - Updated coaching service to use the new parallel tool execution
   - Tool implementations are registered once at service initialization
   - Service can now process multiple tool calls in a single turn

5. **Comprehensive Testing**
   - Added tests for parallel tool execution
   - Tests verify that tools execute concurrently
   - Tests verify that the LLM client handles tool calls correctly
   - Tests verify that the tool registry manages tools across domains

## Benefits of New Approach

1. **Performance**: Multiple tools execute in parallel, reducing latency
2. **Developer Experience**: Cleaner API for registering and managing tools
3. **Reasoning**: LLM can see all available tools at once and make tool calls in batches
4. **Flexibility**: Support for both synchronous and asynchronous tool implementations
5. **Organization**: Clear separation of tool definitions and implementations