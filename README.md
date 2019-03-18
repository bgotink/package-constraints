# package-constraints

> Enforce rules for dependencies in a package or workspace

Constraints provide the answer to many problems that arise when managing a workspace with a
multitude of packages:

- How do I ensure all packages use consistent versions of a certain dependency?
- How can I prevent packages A, B and C from depending on dependency X?
- How can I force packages to put dependency Y in peerDependencies and never in dependencies?

Constraints are written in prolog in a `constraints.pl` or `constraints.pro` file.

## Warning

__Warning__: this package is not stable, the CLI API and rules API is subject to change.

## Inspiration

This package is heavily inspired on the current constraints implementation in `berry`, aka "yarn v2".
It is not compatible with `berry`, but that is subject to change.

## Installation

```bash
yarn add -D package-constraints
# or
npm install -D package-constraints
```

## Usage

We'll assume you use yarn throughout this usage guide. Replace `yarn` with `npx` if you're using
npm.

```bash
yarn constraints check
```

This command will validate the constraints and log errors and a final result to stderr. If errors
are found, the process will exit with a non-zero exit code.

The following options are available:

- `--quiet`: don't log errors and final result to stderr
- `--without-exit-code`: always exit with code `0` unless an unexpected error occurs, i.e. this will
  make the command exit "successfully" if constraints are violated but it will exit with a non-zero
  exit code if the constraints file is missing.
- `--format`: Change the output format, the only supported value is [`tap`](https://testanything.org/).
  If a format is passed, the output of `constraints` will be sent to stdout instead of stderr.
- `--output-file FILE...`: Log output to file(s). Pass the option more than once to output to
  multiple files. This option will add an initial output to the process, i.e. setting an output file
  will not change whether the process logs the result via stdout/stderr. The `FILE` parameter may be
  prefixed with a format, separated from the file path with a colon `:`.

Example usage:

```bash
yarn constraints check --without-exit-code --output-file tap:/dev/fd/1 \
      | yarn tap-junit -n constraints.xml
```

To help with debugging your constraints, you can generate the full constraints file using

```bash
# to output via stdio, e.g. to pipe to another process
yarn constraints generate
# or to store in a file
yarn constraints generate full-constraints.pl
```

You can then inspect the resulting prolog, or load it into a prolog engine to run some queries, e.g.

```bash
yarn constraints generate full-constraints.pl
swipl -f full-constraints.pl
```

## Rules

The following rules are available, filled with the data from the `package.json` files in your
workspace:

### `package/1`

```prolog
package(PackageName).
```

This rule matches all packages in your workspace.

### `private_package/1`

```prolog
private_package(PackageName).
```

This rule matches all private packages in your workspace.

### `root_package/1`

```prolog
root_package(PackageName).
```

This rule matches the package name of the workspace root. If the workspace root doesn't have a name,
as is possible for yarn workspaces, a dummy name will be used instead.

### `dependency_type/1`

```prolog
dependency_type(peerDependencies).
dependency_type(dependencies).
dependency_type(devDependencies).
```

This rule can be used to generate all dependency types. There are only three values: `dependencies`,
`peerDependencies` and `devDependencies`.

### `package_location/2`

```prolog
package_location(PackageName, PackageLocation).
```

This rule gives access to the location of a package, allowing rules to be written based on the
folder structure rather than the package name.

### `package_version/2`

```prolog
package_version(PackageName, Version).
```

This rule links a workspace package with its version.

### `package_has_dependency/4`

```prolog
package_has_dependency(PackageName, DependencyName, DependencyVersion, DependencyType).
```

This rule matches a package with its declared dependencies.

## Queries

The constraints engine will look for matches for the following two predicates:

### `gen_enforced_dependency_range/4`

```prolog
gen_enforced_dependency_range(PackageName, DependencyName, DependencyVersion, DependencyType).
```

This rule is queried for every workspace package and every dependency type. The generated matches
are compared with the actual dependencies listed in the workspace. If a difference is found, a
violation will be logged.

Use a `DependencyVersion` value of `null` to mark a dependency as not allowed.

### `gen_invalid_dependency/4`

```prolog
gen_invalid_dependency(PackageName, DependencyName, DependencyType, Reason).
```

This rule is queried for every workspace package and every dependency type. Every generated match
will be logged as violation.

## Recipes for constraints

This section contains a couple of recipes for constraints.

### Force packages to depend on the workspace version of workspace packages

The following rule requires all dependencies on packages contained in the workspace itself to use
the version in the workspace:

```prolog
gen_enforced_dependency_range(PackageName, DependencyName, DependencyVersion, DependencyType) :-
  package_has_dependency(PackageName, DependencyName, _, DependencyType),
  package_version(DependencyName, DependencyVersion).
```

### Require all peerDependencies to be listed in devDependencies

Peer-dependencies aren't installed automatically, so for local development these need to be
installed separately. The following rule enforces all peer dependencies to be listed as dev
dependency, ensuring the package is installed by your package manager.

```prolog
gen_enforced_dependency_range(PackageName, DependencyName, DependencyVersion, devDependencies) :-
  package_has_dependency(PackageName, DependencyName, DependencyVersion, peerDependencies),
```
