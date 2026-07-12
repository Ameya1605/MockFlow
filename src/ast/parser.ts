import * as fs from 'fs';
import * as path from 'path';
import { InterfaceDeclaration, Project, SyntaxKind } from 'ts-morph';

export function findExportedInterfaces(workspaceRoot: string): Map<string, InterfaceDeclaration> {
  const tsConfigPath = path.join(workspaceRoot, 'tsconfig.json');
  let project: Project;

  if (fs.existsSync(tsConfigPath)) {
    project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  } else {
    project = new Project();
    const sourceFiles = project.addSourceFilesAtPaths(path.join(workspaceRoot, '**/*.ts'));
    sourceFiles.forEach((sourceFile) => {
      if (sourceFile.getFilePath().includes('node_modules') || sourceFile.getFilePath().endsWith('.d.ts')) {
        project.removeSourceFile(sourceFile);
      }
    });
  }

  const interfaces = new Map<string, InterfaceDeclaration>();

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.getFilePath().includes('node_modules') || sourceFile.getFilePath().endsWith('.d.ts')) {
      continue;
    }

    sourceFile.forEachChild((node) => {
      if (node.getKind() === SyntaxKind.InterfaceDeclaration) {
        const declaration = node as InterfaceDeclaration;

        if (!declaration.isExported()) {
          return;
        }

        const name = declaration.getName();
        if (interfaces.has(name)) {
          console.warn(`Duplicate exported interface name found: ${name}`);
          return;
        }

        interfaces.set(name, declaration);
      }
    });
  }

  return interfaces;
}

export function extractSchema(interfaceDecl: InterfaceDeclaration): Record<string, { type: string; optional: boolean }> {
  const schema: Record<string, { type: string; optional: boolean }> = {};

  for (const property of interfaceDecl.getProperties()) {
    const name = property.getName();
    const optional = property.hasQuestionToken();
    const type = property.getType().getText();

    schema[name] = {
      type,
      optional,
    };
  }

  return schema;
}

// Example:
// const interfaces = findExportedInterfaces(workspaceRoot);
// const userSchema = extractSchema(interfaces.get('User')!);
