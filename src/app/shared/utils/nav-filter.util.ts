import { NavItem, NavLeaf } from "../../layout/nav.config";

export function filterNavItems(items: NavItem[], hasMenu: (menuName: string) => boolean): NavItem[] {
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.children) {
      const visibleChildren = item.children.filter((child: NavLeaf) =>
        child.menu ? hasMenu(child.menu) : true,
      );
      if (visibleChildren.length > 0) {
        acc.push({ ...item, children: visibleChildren });
      }
      return acc;
    }

    if (!item.menu || hasMenu(item.menu)) {
      acc.push(item);
    }
    return acc;
  }, []);
}
