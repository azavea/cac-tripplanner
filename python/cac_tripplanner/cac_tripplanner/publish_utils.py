from django.utils.translation import ugettext_lazy


class PublishableMixin:
    """Helper to add Django admin actions to publish and unpublish model objects."""
    actions = ('make_published', 'make_unpublished')

    def make_published(self, request, queryset):
        queryset.update(published=True)
    make_published.short_description = ugettext_lazy("Publish selected %(verbose_name_plural)s")

    def make_unpublished(self, request, queryset):
        queryset.update(published=False)
    make_unpublished.short_description = ugettext_lazy("Unpublish selected %(verbose_name_plural)s")
