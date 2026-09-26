// The public tree's go.mod. This is the ONE file whose public content differs from
// the private repo at the same path: the private services/ module also contains
// never-public binaries and their dependencies. pool-coin-router imports the
// standard library only, so it needs nothing else to build.
module github.com/pwndaCreate/PwndaServer/services

go 1.21
