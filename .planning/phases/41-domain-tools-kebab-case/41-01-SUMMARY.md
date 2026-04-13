---
wave: 1
requirements: []
files_modified:
  - be/app/domain/schema_finder.py
  - be/app/domain/tools.py
  - be/app/domain/loader.py
  - be/domains/personal-finance/chests
  - be/domains/test-domain/chests
---

# Summary 41-01: Domain-Specific Tool Files and Kebab Case Standardization

## Goal Achieved

Refactored domain tools and file naming to use a more structured approach with domain-specific tool files and consistent kebab-case naming. Each domain chest now has its own dedicated tool file with a clear structure rather than using a generic chest tool for all domains.

## Implementation Details

1. **Schema Finder with Kebab-Case Support**
   - Created a schema finder that supports both kebab-case and snake_case patterns for backward compatibility
   - Schema finder looks for files in the new directory structure (`chests/user-profile/user-profile.schema.json`)
   - Maintains fallback to legacy paths for backward compatibility

2. **Domain-Specific Tool Loading**
   - Implemented tool loading from dedicated tool files (`user-profile.tool.yaml`)
   - Each tool has its own schema, description, and parameters
   - Tools are fully domain-specific rather than generic

3. **Directory Structure Reorganization**
   - Moved from flat structure to nested: `chests/user-profile/user-profile.schema.json`
   - Each chest has its own directory with all related files
   - Consistent kebab-case naming for all files and directories

4. **Converted personal-finance Domain**
   - Restructured all schema files to use kebab-case
   - Created domain-specific tool files for each chest
   - Updated manifest to reference new file paths

5. **Converted test-domain**
   - Applied the same structure and naming conventions
   - Added tool files for test domain chests
   - Ensured consistent approach across all domains

## Test Coverage

- Added tests for schema finder with both kebab-case and legacy support
- Added tests for loading tools from the new structure
- Ensured backward compatibility with existing code

## Benefits of New Structure

1. **Modularity**: Each chest has a self-contained directory with all related files
2. **Consistency**: Kebab-case naming convention across all domain files
3. **Domain-specificity**: Tools are defined per-domain rather than generic
4. **Maintainability**: Easier to find and modify related files
5. **Extensibility**: Each chest can have additional domain-specific files added as needed