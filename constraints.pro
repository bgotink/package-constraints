constraints_min_version(1).

% This file is written in Prolog
% It contains rules that the project must respect.
% In order to see them in action, run `berry constraints detail`

% This rule will prevent two of our workspaces from depending on different versions of a same dependency
gen_invalid_dependency(PackageName, DependencyName, DependencyType, 'This dependency conflicts with another one from another workspace') :-
  package_has_dependency(PackageName, DependencyName, DependencyRange, DependencyType),
  package_has_dependency(_, DependencyName, DependencyRange2, _),
  DependencyRange \= DependencyRange2,
  \+(gen_enforced_dependency_range(PackageName, DependencyName, _, DependencyType)).

% This rule will prevent workspaces from depending on non-workspace versions of available workspaces
gen_enforced_dependency_range(PackageName, DependencyName, 'workspace:*', DependencyType) :-
  package(DependencyName),
  package_has_dependency(PackageName, DependencyName, _, DependencyType).

% The following rules describes which workspaces are allowed to depend on respectively "webpack" and "typescript"
package_allowed_dependency('@berry/builder', 'webpack').
package_allowed_dependency('@berry/builder', 'typescript').

% This rule will prevent workspaces from depending any blacklisted package
gen_enforced_dependency_range(PackageName, DependencyName, null, DependencyType) :-
  package_has_dependency(PackageName, DependencyName, _, DependencyType),
  package_allowed_dependency(_, DependencyName),
  \+(package_allowed_dependency(PackageName, DependencyName)).

% This rule will prevent all workspaces from depending on tslib
gen_enforced_dependency_range(PackageName, 'tslib', null, DependencyType) :-
  package_has_dependency(PackageName, 'tslib', _, DependencyType).

% This rule requires peerDependencies to be listed as devDependency
gen_enforced_dependency_range(PackageName, DependencyName, DependencyRange, devDependencies) :-
  package_has_dependency(PackageName, DependencyName, PeerDependencyRange, peerDependencies),
  atom_concat('^', DependencyRange, PeerDependencyRange).
gen_enforced_dependency_range(PackageName, DependencyName, DependencyRange, devDependencies) :-
  package_has_dependency(PackageName, DependencyName, DependencyRange, peerDependencies),
  \+(sub_atom(DependencyRange, 0, 1, _, '^')).
