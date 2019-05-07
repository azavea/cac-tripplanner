from django import template

register = template.Library()


@register.simple_tag(name='has_activity')
def has_activity(destination, activity_name):
    """Test if a given activity is available at the passed destination."""
    return destination.has_activity(activity_name) if destination else False


@register.simple_tag(name='get_directions_id')
def get_directions_id(destination):
    """Get place ID for directions, which is place ID for associated destination, if an event."""
    if hasattr(destination, 'destination'):
        # event with a related destination; use it for directions
        if destination.destination:
            return destination.destination.id
        else:
            # event without a destination
            return None
    else:
        # not an event
        return destination.id
