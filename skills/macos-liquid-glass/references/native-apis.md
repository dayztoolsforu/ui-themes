# Liquid Glass — native Apple APIs

For real macOS/iOS apps (Xcode 26+, macOS 26 / iOS 26 SDK). Rule one: **use standard
components** — they adopt Liquid Glass automatically on rebuild. Hand-rolled glass is the
exception, and remove any custom backgrounds from bars, toolbars, split views and sheets so
they don't cover the system material.

| Need | SwiftUI | AppKit | UIKit |
|------|---------|--------|-------|
| Glass on a custom view | `.glassEffect(_:in:)` e.g. `.glassEffect(.regular, in: .capsule)` | `NSGlassEffectView` | `UIGlassEffect` (in `UIVisualEffectView`) |
| Variants | `Glass.regular`, `Glass.clear`, `.tint(_:)`, `.interactive()` | `NSGlassEffectView.style` | `UIGlassEffect(style:)` |
| Group / morph several glass shapes | `GlassEffectContainer(spacing:)` + `.glassEffectID(_:in:)` with a `@Namespace` | `NSGlassEffectContainerView` | `UIGlassContainerEffect` |
| Glass button | `.buttonStyle(.glass)` / `.glassProminent` | `NSButton.BezelStyle.glass` | `UIButton.Configuration.glass()` / `.prominentGlass()` / `.clearGlass()` |
| Concentric corners | `ConcentricRectangle`, `.rect(corners:isUniform:)` | automatic | `UICornerConfiguration` / `cornerConfiguration` |
| Sidebar + content | `NavigationSplitView` | `NSSplitViewController` | `UISplitViewController` |
| Inspector | `.inspector(isPresented:)` | `NSSplitViewItem(inspectorWithViewController:)` | `.Column.inspector` |
| Content extends under sidebar | `.backgroundExtensionEffect()` | `NSBackgroundExtensionView` | `UIBackgroundExtensionView` |
| Legibility under bars | `.scrollEdgeEffectStyle(_:for:)`, `.safeAreaBar(edge:)` | automatic for `NSToolbar` | `UIScrollEdgeElementContainerInteraction` |
| Toolbar group spacing | `ToolbarSpacer(.fixed)` | `NSToolbarItem.Identifier.space` | `UIBarButtonItem.fixedSpace(_:)` |
| Hide empty toolbar items | `.hidden(_:)` on `ToolbarContent` | `NSToolbarItem.isHidden` | `UIBarButtonItem.isHidden` |
| Tab bar ↔ sidebar | `.tabViewStyle(.sidebarAdaptable)` | — | `tabBarController.mode = .tabSidebar` |
| Search tab | `Tab(role: .search)` | — | `UISearchTab` |
| Tab bar shrinks on scroll (iOS) | `.tabBarMinimizeBehavior(.onScrollDown)` | — | `tabBarMinimizeBehavior` |
| Grouped forms | `.formStyle(.grouped)` | — | — |
| Opt out temporarily | `UIDesignRequiresCompatibility = YES` in Info.plist | same | same |

Content-layer surfaces use `Material` (`.ultraThinMaterial` … `.thickMaterial`) in SwiftUI,
`NSVisualEffectView` in AppKit — not glass.

Minimal SwiftUI morphing example:

```swift
@Namespace private var ns
@State private var expanded = false

GlassEffectContainer(spacing: 12) {
    HStack(spacing: 12) {
        Button { expanded.toggle() } label: { Image(systemName: "pencil") }
            .glassEffect(.regular.interactive(), in: .circle)
            .glassEffectID("edit", in: ns)
        if expanded {
            Button {} label: { Image(systemName: "eraser") }
                .glassEffect(.regular.interactive(), in: .circle)
                .glassEffectID("erase", in: ns)
        }
    }
}
.animation(.spring(duration: 0.4), value: expanded)
```

App icons: layered (foreground/middle/background) built in **Icon Composer**; the system adds
the glass reflection, refraction, blur and shadow — don't bake those in. Provide default,
dark, clear and tinted appearances.

Sources: developer.apple.com/documentation/technologyoverviews/liquid-glass,
…/adopting-liquid-glass, HIG › Materials, WWDC25 sessions 219, 323, 310, 356.
